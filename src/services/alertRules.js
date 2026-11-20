/**
 * Rule-based alerts built from the REAL replayed model outputs (no random events).
 *
 *  bearing   : sustained anomaly alarm (3 snapshots in a row above the calibrated threshold),
 *              severe escalation (score > 10x threshold), unsustained "watch" flags
 *  hydraulic : the model's diagnosis of the 4 components stays the same for 5 cycles and differs
 *              from the last alerted diagnosis; at most one hydraulic alert per 60 cycles
 *  energy    : usage above the expected-usage baseline by more than the calibrated threshold
 *              for 2+ intervals in a row; at most one energy alert per 16 intervals (4 h)
 *
 * Severity for hydraulic comes from the dataset's own condition labels (e.g. cooler 3% = "close
 * to total failure"). Suggested checks are generic, rule-based maintenance advice.
 */

const TCO2_PER_KWH = 0.0004; // implied by the steel dataset (CO2 column is derived from kWh)

const HYD_COMPONENTS = [
  { key: 'cooler', label: 'Cooler', healthy: 100, unit: '% efficiency',
    sev: { 3: 'High', 20: 'Warning' },
    meaning: { 3: 'close to total failure', 20: 'reduced efficiency' },
    check: 'Inspect the cooler for fouling or blocked passages and check coolant flow and temperatures.',
    reliability: 0.98 },
  { key: 'valve', label: 'Valve', healthy: 100, unit: '% switching',
    sev: { 73: 'High', 80: 'High', 90: 'Warning' },
    meaning: { 73: 'close to total failure', 80: 'severe switching lag', 90: 'small switching lag' },
    check: 'Inspect the valve for sticking or lag and check switching times against specification.',
    reliability: 0.67 },
  { key: 'pump_leak', label: 'Pump leakage', healthy: 0, unit: '',
    sev: { 2: 'High', 1: 'Warning' },
    meaning: { 2: 'severe internal leakage', 1: 'weak internal leakage' },
    check: 'Inspect pump seals and measure volumetric efficiency; plan a pump overhaul if leakage is severe.',
    reliability: 0.99 },
  { key: 'accumulator', label: 'Accumulator', healthy: 130, unit: ' bar pre-charge',
    sev: { 90: 'High', 100: 'Warning', 115: 'Low' },
    meaning: { 90: 'close to total failure', 100: 'severely reduced pressure', 115: 'slightly reduced pressure' },
    check: 'Check the accumulator gas pre-charge pressure and bladder condition.',
    reliability: 0.79 },
];
const RANK = { Low: 1, Warning: 2, High: 3 };

const fileTime = (f) => {
  const p = String(f || '').split('.');
  return p.length === 6 ? `${p[0]}-${p[1]}-${p[2]} ${p[3]}:${p[4]}` : String(f || '');
};

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const std = (a) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) || 1e-9;
};
const z = (v, base) => Math.abs((v - mean(base)) / std(base));

export function createAlertDetectors() {
  const st = {
    bearing: { alarmed: false, escalated: false, lastWatch: -1e9 },
    hydraulic: { last: null, same: 0, alerted: null, lastAlertIdx: -1e9 },
    energy: { run: 0, lastAlertIdx: -1e9 },
    plant: { run: 0, lastHigh: -1e9, idleRun: 0, lastIdle: -1e9 },
  };

  const bearing = (m, hist) => {
    const out = [];
    const s = st.bearing;
    const base = hist.slice(0, 100);
    const baseline = base.length >= 30
      ? { rms: base.map((x) => x.rms), kurt: base.map((x) => x.kurtosis) } : null;
    const causes = baseline
      ? [{ sensor: 'rms', impact: z(m.rms, baseline.rms) }, { sensor: 'kurtosis', impact: z(m.kurtosis, baseline.kurt) }]
      : [];
    const rmsPct = baseline ? ((m.rms / mean(baseline.rms) - 1) * 100) : null;
    const common = {
      machine: 'BEARING TEST RIG', source: 'bearing', chartTitle: 'Deviation from healthy baseline (z-score)',
      recorded: fileTime(m.file),
    };

    if (m.alarm && !s.alarmed) {
      s.alarmed = true;
      out.push({
        ...common, severity: 'High',
        title: 'Bearing fault alarm',
        description: `Anomaly score ${m.error.toFixed(2)} stayed above the threshold ${m.threshold.toFixed(2)} for 3 snapshots in a row (recorded ${common.recorded}).`,
        rootCause: 'Sustained vibration anomaly compared with the bearing\'s own healthy baseline',
        rootCauseDetail: baseline
          ? `Vibration RMS is ${rmsPct.toFixed(0)}% above its healthy level (${causes[0].impact.toFixed(1)} sigma); kurtosis is ${causes[1].impact.toFixed(1)} sigma from normal.`
          : 'Pattern detected by the anomaly model.',
        action: 'Schedule an inspection of this bearing (lubrication, wear, outer/inner race damage) before the next planned run.',
        additionalActions: [
          'Compare the vibration spectrum with the healthy reference to identify the fault frequency',
          'Check lubrication condition and temperature trend',
          'Reduce load or plan a controlled stop if the score keeps rising',
        ],
        topCauses: causes,
        log: `Rule: 3 consecutive snapshots above calibrated threshold\nSnapshot ${m.index + 1}/${m.total}\nScore: ${m.error.toFixed(3)}  Threshold: ${m.threshold.toFixed(3)}\nRMS: ${m.rms.toFixed(4)}  Kurtosis: ${m.kurtosis.toFixed(2)}\nReplay context: in this recording the bearing failed ${m.lead_hours} h later`,
      });
    }
    if (m.error > 10 * m.threshold && !s.escalated) {
      s.escalated = true;
      out.push({
        ...common, severity: 'High',
        title: 'Bearing degradation accelerating',
        description: `Anomaly score is ${(m.error / m.threshold).toFixed(0)}x the alarm threshold (recorded ${common.recorded}).`,
        rootCause: 'Fault progression: the anomaly score has grown more than 10x past the alarm level',
        rootCauseDetail: baseline ? `Vibration RMS is now ${rmsPct.toFixed(0)}% above its healthy level.` : 'Pattern detected by the anomaly model.',
        action: 'Treat as urgent: plan an immediate stop and bearing replacement.',
        additionalActions: ['Confirm with a handheld vibration measurement', 'Prepare a spare bearing'],
        topCauses: causes,
        log: `Rule: score > 10 x threshold\nSnapshot ${m.index + 1}/${m.total}\nScore: ${m.error.toFixed(3)}  Threshold: ${m.threshold.toFixed(3)}\nReplay context: ${m.hours_to_end_of_run} h left in the recording`,
      });
    }
    if (m.status === 'WATCH' && m.index >= 10 && m.index - s.lastWatch > 100 && !s.alarmed) {
      s.lastWatch = m.index;
      out.push({
        ...common, severity: 'Low',
        title: 'Possible bearing anomaly (not yet sustained)',
        description: `Anomaly score briefly exceeded the threshold (${m.error.toFixed(2)} vs ${m.threshold.toFixed(2)}).`,
        rootCause: 'A single out-of-range snapshot. It may be noise, so it is not yet an alarm.',
        rootCauseDetail: 'The alarm rule needs 3 consecutive snapshots above the threshold.',
        action: 'No action needed yet. Keep watching the trend.',
        additionalActions: [],
        topCauses: causes,
        log: `Rule: 1 snapshot above threshold, fewer than 3 in a row\nSnapshot ${m.index + 1}/${m.total}\nScore: ${m.error.toFixed(3)}`,
      });
    }
    return out;
  };

  const hydraulic = (m) => {
    const s = st.hydraulic;
    const key = HYD_COMPONENTS.map((c) => m[`pred_${c.key}`]).join('|');
    s.same = key === s.last ? s.same + 1 : 1;
    s.last = key;
    if (s.same !== 5 || key === s.alerted || m.index - s.lastAlertIdx < 60) return [];

    const degraded = HYD_COMPONENTS.filter((c) => m[`pred_${c.key}`] !== c.healthy);
    s.alerted = key; // remember the diagnosis even when healthy so we only alert on changes
    if (degraded.length === 0) return [];

    s.lastAlertIdx = m.index;
    const sev = degraded.map((c) => c.sev[m[`pred_${c.key}`]] || 'Low')
      .reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'Low');
    const names = degraded.map((c) => `${c.label} (${c.meaning[m[`pred_${c.key}`]] || m[`pred_${c.key}`]})`);
    const truth = degraded.map((c) => `${c.label}: recorded ${m[`true_${c.key}`]}, model ${m[`pred_${c.key}`]} -> ${m[`ok_${c.key}`] ? 'correct' : 'WRONG'}`);
    return [{
      machine: 'HYDRAULIC RIG', source: 'hydraulic', severity: sev,
      title: `Hydraulic rig: ${degraded.map((c) => c.label.toLowerCase()).join(' + ')} degraded`,
      description: `Model diagnosis stable for 5 cycles (cycle ${m.index + 1} of ${m.total}): ${names.join('; ')}.`,
      rootCause: degraded.length > 1 ? 'Several components diagnosed as degraded at the same time' : `${degraded[0].label} diagnosed as degraded`,
      rootCauseDetail: `Diagnosis reliability on held-out data: ${degraded.map((c) => `${c.label} ~${Math.round(c.reliability * 100)}%`).join(', ')}. Per-sensor attribution is not computed for this model.`,
      action: degraded[0].check,
      additionalActions: degraded.slice(1).map((c) => c.check),
      topCauses: [],
      chartTitle: 'Sensor Impact Analysis',
      log: `Rule: diagnosis unchanged for 5 cycles; at most one hydraulic alert per 60 cycles\nCycle ${m.index + 1}/${m.total}\nMotor ${m.EPS1_mean.toFixed(0)} W, oil ${m.TS1_mean.toFixed(1)} C, pressure ${m.PS1_mean.toFixed(0)} bar\nReplay check (recorded labels vs model):\n${truth.join('\n')}`,
    }];
  };

  const energy = (m) => {
    const s = st.energy;
    s.run = m.high ? s.run + 1 : 0;
    if (s.run !== 2 || m.index - s.lastAlertIdx < 16) return [];
    s.lastAlertIdx = m.index;
    const excess = m.kwh - m.expected;
    const severe = excess > 2 * m.high_threshold_kwh;
    return [{
      machine: 'STEEL PLANT', source: 'energy', severity: severe ? 'High' : 'Warning',
      title: 'Unexpectedly high plant energy use',
      description: `Usage ran above the expected baseline for 2 intervals in a row (${m.date.slice(0, 16)}): ${m.kwh.toFixed(1)} kWh vs ${m.expected.toFixed(1)} expected.`,
      rootCause: 'Energy use is well above the level the calendar baseline predicts for this time and day',
      rootCauseDetail: `About +${excess.toFixed(0)} kWh in this interval (alert threshold ${m.high_threshold_kwh.toFixed(0)} kWh). At the plant's emission factor that is roughly ${(excess * TCO2_PER_KWH).toFixed(3)} tCO2 per interval. It may be legitimate production, not waste.`,
      action: 'Check what was running in this interval (production schedule vs unscheduled load).',
      additionalActions: ['Review off-shift base load', 'Check compressed air, HVAC and idling equipment for leaks or waste'],
      topCauses: [],
      chartTitle: 'Sensor Impact Analysis',
      log: `Rule: above (expected + ${m.high_threshold_kwh.toFixed(0)} kWh) for 2 consecutive intervals; at most one alert per 4 h\nInterval ${m.index + 1}/${m.total}  ${m.date}\nActual ${m.kwh.toFixed(2)} kWh  Expected ${m.expected.toFixed(2)} kWh\nCumulative: ${m.cum_kwh.toLocaleString()} kWh, ${m.cum_tco2} tCO2 (CO2 is derived from kWh in this dataset)`,
    }];
  };

  const plant = (m) => {
    const s = st.plant;
    const out = [];
    // Profile and calibration weeks are the data the baseline was fit on, so only the held-out
    // test weeks raise alerts (flags elsewhere would be in-sample noise).
    if (m.split !== 'test' && m.split !== 'live') return out;
    const common = { machine: 'ELECTRONICS PLANT', source: 'plant', chartTitle: 'Sensor Impact Analysis', topCauses: [] };
    s.run = m.high ? s.run + 1 : 0;
    if (s.run === 2 && m.index - s.lastHigh >= 8) {
      s.lastHigh = m.index;
      const excess = m.main_kw - m.expected_kw;
      out.push({
        ...common, severity: excess > 2 * m.threshold_kw ? 'High' : 'Warning',
        title: 'Plant power above weekday baseline',
        description: `Main meter ${m.main_kw.toFixed(1)} kW vs ${m.expected_kw.toFixed(1)} kW expected for this time (${m.time}, ${m.split} period), 2 intervals in a row.`,
        rootCause: 'Plant draw is higher than the learned weekday pattern for this time of day',
        rootCauseDetail: `About +${excess.toFixed(1)} kW (alert threshold ${m.threshold_kw.toFixed(1)} kW). Only ${m.metered_kw.toFixed(1)} kW of that is on the 10 sub-metered machines, so the cause is probably in unmetered load (HVAC, lighting, other equipment) or a production change.`,
        action: 'Check what is running now beyond the sub-metered machines, and whether the schedule changed.',
        additionalActions: ['Review HVAC and compressed-air load', 'Compare with the same time on previous days'],
        log: `Data split: ${m.split} (only 'test' is held out; earlier flags are in-sample)
Rule: main power > weekday profile + ${m.threshold_kw.toFixed(1)} kW for 2 consecutive 15-min intervals; at most one per 2 h
Interval ${m.index + 1}/${m.total}  ${m.time}
Main ${m.main_kw.toFixed(2)} kW  Expected ${m.expected_kw.toFixed(2)} kW
Sub-metered machines: ${m.metered_kw.toFixed(2)} kW`,
      });
    }
    s.idleRun = m.idle && m.main_kw > 1.6 * m.base_kw ? s.idleRun + 1 : 0;
    if (s.idleRun === 4 && m.index - s.lastIdle >= 96) {
      s.lastIdle = m.index;
      out.push({
        ...common, severity: 'Low',
        title: 'High plant load while no sub-metered machine runs',
        description: `For 1 hour the plant drew ${m.main_kw.toFixed(1)} kW (base load ${m.base_kw.toFixed(1)} kW) while the 10 metered machines were idle (${m.time}).`,
        rootCause: 'Load not explained by the metered machines',
        rootCauseDetail: 'This is a standby / unmetered-load indicator, not a fault. It may be legitimate (HVAC, lighting, other lines). Base load is a large share of plant energy in this data.',
        action: 'Identify the unmetered loads and check whether they can be switched off out of hours.',
        additionalActions: ['Add sub-meters on HVAC and lighting circuits'],
        log: `Data split: ${m.split}
Rule: main > 1.6 x base load while all metered machines < 0.5 kW, 4 intervals in a row; at most one per day
Interval ${m.index + 1}/${m.total}  ${m.time}
Main ${m.main_kw.toFixed(2)} kW  Base ${m.base_kw.toFixed(2)} kW  Metered ${m.metered_kw.toFixed(2)} kW`,
      });
    }
    return out;
  };

  return {
    process(name, m, hist) {
      if (name === 'bearing') return bearing(m, hist);
      if (name === 'hydraulic') return hydraulic(m);
      if (name === 'energy') return energy(m);
      if (name === 'plant') return plant(m);
      return [];
    },
  };
}
