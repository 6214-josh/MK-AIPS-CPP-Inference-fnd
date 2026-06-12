import React, { useEffect, useMemo, useState } from 'react'
import apiClient from '../api/apiClient'

const DASHBOARD_TABS = [
  { key: 'overview', label: '即時總覽' },
  { key: 'ai_board', label: 'AI 排程看板' },
  { key: 'reward', label: 'DQN Reward 分析' },
  { key: 'work_orders', label: '工單管理' },
  { key: 'machines', label: '機台管理' },
  { key: 'materials', label: '物料管理' },
  { key: 'tools', label: '刀具管理' },
  { key: 'reports', label: '報表分析' },
  { key: 'maintenance', label: '預測維護' },
  { key: 'settings', label: '系統設定' },
]

const REWARD_EVENT_COLORS = [
  { stroke: "#8b5cf6", fill: "#7c3aed" },
  { stroke: "#38bdf8", fill: "#2563eb" },
  { stroke: "#f59e0b", fill: "#d97706" },
  { stroke: "#ef4444", fill: "#dc2626" },
  { stroke: "#0ea5e9", fill: "#0284c7" },
  { stroke: "#a855f7", fill: "#7e22ce" },
]

function pad2(value) {
  return String(value).padStart(2, '0')
}

function stableKey(prefix, row, index) {
  const parts = [
    row?.reward_log_id,
    row?.reward_id,
    row?.schedule_id,
    row?.action_id,
    row?.state_id,
    row?.meter_data_id,
    row?.feature_id,
    row?.work_order_no,
    row?.product_no,
    row?.product_code,
    row?.cnc_machine_id,
    row?.machine_id,
    row?.operation_seq,
    row?.decision_step_no,
    row?.schedule_run_id,
    row?.calculated_at,
    row?.reward_time,
  ].filter((item) => item !== undefined && item !== null && item !== '')
  return `${prefix}-${parts.join('-') || 'row'}-${index}`
}

function todayText() {
  return new Date().toISOString().slice(0, 10)
}

function formatDateTime() {
  const d = new Date()
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function formatNumber(value, digits = 1) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '0'
  return n.toFixed(digits)
}

function formatPercent(value, digits = 1) {
  return `${formatNumber(value, digits)}%`
}

function statusText(status) {
  const map = {
    RUNNING: '加工中',
    IDLE: '待機中',
    ALARM: '異常中',
    SCHEDULED: '待加工',
    MAINTENANCE: '保養中',
    OFFLINE: '離線中',
    NO_DATA: '離線中',
  }
  return map[status] || status || '-'
}

function statusClass(status) {
  const s = String(status || '').toLowerCase()
  if (s.includes('alarm')) return 'alarm'
  if (s.includes('idle') || s.includes('scheduled')) return 'idle'
  if (s.includes('maintenance')) return 'maintain'
  if (s.includes('offline') || s.includes('no_data')) return 'offline'
  return 'running'
}

function levelClass(level) {
  const v = String(level || '').toLowerCase()
  if (v.includes('high') || v.includes('高') || v.includes('alarm')) return 'bad'
  if (v.includes('medium') || v.includes('中') || v.includes('warn')) return 'warn'
  return 'good'
}

function scopeText(scope) {
  const map = {
    WORK_ORDER: '工單',
    MACHINE: '機台',
    OPERATION: '工序',
    SCHEDULE_GLOBAL: '整體排程',
    MATERIAL: '物料',
    TOOLING: '刀具',
    QUALITY: '品質',
    MAINTENANCE: '維護',
  }
  return map[scope] || scope || '-'
}

function KpiTile({ label, value, sub, tone = 'normal' }) {
  return (
    <div className={`war-kpi-tile tone-${tone}`}>
      <div className="war-kpi-label">{label}</div>
      <div className="war-kpi-main">{value}</div>
      <div className="war-kpi-sub">{sub}</div>
    </div>
  )
}

function StatusDot({ status }) {
  return <span className={`war-status-dot ${statusClass(status)}`} />
}

function MiniRing({ value, label }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)))
  return (
    <div className="war-mini-ring" style={{ '--pct': `${safe}%` }}>
      <div>
        <b>{safe}</b>
        <span>{label}</span>
      </div>
    </div>
  )
}

function StatusMiniRing({ value, tone = 'running' }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)))
  return <span className={`war-status-mini-ring tone-${tone}`} style={{ '--pct': `${safe}%` }} />
}

function OverviewStatusPanel({ kpi, nowText }) {
  const total = Math.max(Number(kpi.cnc_total || 14), 1)
  const rows = [
    { label: '機台總數', value: `${total} 台`, pct: null, tone: 'normal' },
    { label: '加工中', value: `${kpi.running_count || 0} 台`, pct: (Number(kpi.running_count || 0) / total) * 100, tone: 'running' },
    { label: '待機中', value: `${kpi.idle_count || 0} 台`, pct: (Number(kpi.idle_count || 0) / total) * 100, tone: 'idle' },
    { label: '異常中', value: `${kpi.alarm_count || 0} 台`, pct: (Number(kpi.alarm_count || 0) / total) * 100, tone: 'alarm' },
    { label: '保養中', value: `${kpi.maintenance_count || 0} 台`, pct: (Number(kpi.maintenance_count || 0) / total) * 100, tone: 'maintain' },
    { label: '離線中', value: `${kpi.offline_count || 0} 台`, pct: (Number(kpi.offline_count || 0) / total) * 100, tone: 'offline' },
  ]
  return (
    <section className="war-left-card war-overview-status-card">
      <div className="war-left-card-head"><h3>即時總覽</h3><span>更新時間：{String(nowText || '').slice(-8)}</span></div>
      <div className="war-status-summary-list">
        {rows.map((row, index) => (
          <div key={row.label} className={`war-status-summary-row tone-${row.tone}`}>
            <div>
              <span>{row.label}</span>
              <b>{row.value}</b>
            </div>
            {row.pct !== null && (
              <div className="war-status-summary-right">
                <em>{formatPercent(row.pct, 0)}</em>
                <StatusMiniRing value={row.pct} tone={row.tone} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function CompactRealtimeKpi({ kpi }) {
  const oee = Math.round(Number(kpi.today_oee || 0))
  return (
    <section className="war-left-card war-realtime-kpi-card">
      <h3>即時 KPI</h3>
      <div className="war-realtime-kpi-body">
        <MiniRing value={oee} label="OEE" />
        <div className="war-kpi-list compact">
          <span>稼動率 <b>{formatPercent(kpi.realtime_utilization_rate || 0, 0)}</b></span>
          <span>Performance <b>{formatPercent(Math.min(100, Number(kpi.realtime_utilization_rate || 0) + 8), 0)}</b></span>
          <span>良品率 <b>{formatPercent(98, 0)}</b></span>
        </div>
      </div>
    </section>
  )
}

function CompactLearningPanel({ rewardStats, data }) {
  const bottom = data?.ai_board_bottom || {}
  const learning = bottom.learning || {}
  const score = Number(learning.avg_reward_score ?? rewardStats.avgScore ?? 82)
  const progressRate = Number(learning.learning_progress_rate || 63)
  const current = Number(learning.episode_count || 1256720)
  const target = Number(learning.episode_target || 2000000)
  return (
    <section className="war-left-card war-learning-card-compact">
      <h3>DQN 學習狀態</h3>
      <div className="war-learning-score-row">
        <span>平均 Reward 分數</span>
        <strong>{formatNumber(score, 1)} <em>/ 100</em></strong>
      </div>
      <MiniTrendLine values={learning.trend || [72, 74, 76, 79, 78, 82, 84, 83, 86, 85, 88, 92]} height={48} />
      <div className="war-learning-meter compact">
        <div><i style={{ width: `${Math.max(0, Math.min(100, progressRate))}%` }} /></div>
        <span>學習進度 {formatPercent(progressRate, 1)}　{current.toLocaleString()} / {target.toLocaleString()}</span>
      </div>
    </section>
  )
}

function ProgressBar({ value, max = 100, colorClass = 'good', label, suffix = '%' }) {
  const safeMax = Math.max(Number(max || 1), 1)
  const safe = Math.max(0, Math.min(100, Number(value || 0) / safeMax * 100))
  return (
    <div className="war-progress-row">
      {label && <span>{label}</span>}
      <div className="war-progress-track"><i className={colorClass} style={{ width: `${safe}%` }} /></div>
      <b>{suffix === '%' ? formatPercent(value, 1) : `${formatNumber(value, 1)}${suffix}`}</b>
    </div>
  )
}

function WarGantt({ rows, cards, viewMode = 'week' }) {
  const cncCodes = Array.from({ length: 14 }, (_, index) => `CNC-${pad2(index + 1)}`)
  const grouped = useMemo(() => {
    const map = {}
      ; (rows || []).forEach((row) => {
        if (!map[row.cnc_machine_id]) map[row.cnc_machine_id] = []
        map[row.cnc_machine_id].push(row)
      })
    return map
  }, [rows])
  const cardMap = useMemo(() => Object.fromEntries((cards || []).map((c) => [c.cnc_machine_id, c])), [cards])

  const timeLabels = viewMode === 'day'
    ? ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00']
    : viewMode === 'month'
      ? ['第1週', '第2週', '第3週', '第4週', '第5週', '本月累積', '預測']
      : ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

  function positionForItem(item) {
    if (viewMode === 'day') {
      return {
        left: Math.max(0, Math.min(Number(item.left_percent || 0), 99)),
        width: Math.max(Number(item.width_percent || 0), 4),
      }
    }

    const dateText = String(item.schedule_date || item.start_time_text || '')
    const d = dateText ? new Date(dateText.length <= 10 ? `${dateText}T08:00:00` : dateText.replace(' ', 'T')) : null
    const valid = d && !Number.isNaN(d.getTime())
    if (viewMode === 'week') {
      const dayIndex = valid ? ((d.getDay() + 6) % 7) : 0
      const insideDay = Math.max(0, Math.min(Number(item.left_percent || 0) / 100, 0.88))
      return {
        left: Math.min(98, (dayIndex + insideDay) / 7 * 100),
        width: Math.max(4, Math.min(Number(item.width_percent || 0) / 7, 13)),
      }
    }

    const day = valid ? d.getDate() : 1
    const weekIndex = Math.min(4, Math.floor((day - 1) / 7))
    const insideWeek = ((day - 1) % 7) / 7
    return {
      left: Math.min(98, (weekIndex + insideWeek) / 5 * 100),
      width: Math.max(4, Math.min(Number(item.width_percent || 0) / 5, 16)),
    }
  }

  return (
    <div className={`war-gantt war-gantt-${viewMode}`}>
      <div className="war-gantt-header">
        <span>機台</span>
        <span>狀態</span>
        {timeLabels.map((label) => <span key={`gantt-label-${viewMode}-${label}`}>{label}</span>)}
        <span>進度</span>
        <span>剩餘時間</span>
      </div>

      {cncCodes.map((cnc) => {
        const items = grouped[cnc] || []
        const card = cardMap[cnc] || {}
        return (
          <div className="war-gantt-row" key={`gantt-row-${viewMode}-${cnc}`}>
            <div className="war-gantt-machine">{cnc}</div>
            <div className="war-gantt-state">
              <StatusDot status={card.status} />
              <b>{formatPercent(card.utilization_rate || 0, 0)}</b>
            </div>
            <div className="war-gantt-track">
              <div className="war-now-line" />
              {items.map((item, index) => {
                const pos = positionForItem(item)
                return (
                  <div
                    key={stableKey(`gantt-bar-${viewMode}-${cnc}`, item, index)}
                    className={`war-gantt-bar ${item.schedule_status === 'OVER_CAPACITY' ? 'danger' : ''} ${item.is_ai_prediction ? 'predicted' : ''}`}
                    style={{ left: `${pos.left}%`, width: `${pos.width}%` }}
                    title={`${item.work_order_no || '-'} / ${item.product_no || '-'} / ${item.start_time_text || ''} - ${item.end_time_text || ''}`}
                  >
                    {item.work_order_no || item.product_no || 'JOB'}
                  </div>
                )
              })}
            </div>
            <div className="war-gantt-progress">{card.over_capacity_hours > 0 ? '延遲' : formatPercent(card.utilization_rate || 0, 0)}</div>
            <div className="war-gantt-remaining">{card.remaining_time_text || card.current_remaining_text || (card.current_work_order_no ? '02:15' : '--')}</div>
          </div>
        )
      })}
    </div>
  )
}

function StatusDistribution({ kpi }) {
  const total = Math.max(Number(kpi.cnc_total || 14), 1)
  const rows = [
    ['加工中', kpi.running_count || 0, 'running', '#22c55e'],
    ['待機中', kpi.idle_count || 0, 'idle', '#eab308'],
    ['異常中', kpi.alarm_count || 0, 'alarm', '#ef4444'],
    ['保養中', kpi.maintenance_count || 0, 'maintain', '#8b5cf6'],
    ['離線中', kpi.offline_count || 0, 'offline', '#64748b'],
  ]
  let cursor = 0
  const segments = rows.map(([, count, , color]) => {
    const pct = Number(count || 0) / total * 100
    const seg = `${color} ${cursor}% ${cursor + pct}%`
    cursor += pct
    return seg
  }).join(', ')
  const donutBg = cursor > 0 ? `conic-gradient(${segments}, rgba(100,116,139,.28) ${cursor}% 100%)` : undefined

  return (
    <div className="war-status-distribution">
      <div className="war-donut" style={{ background: donutBg }}>
        <div><b>{total}</b><span>總計</span></div>
      </div>
      <div className="war-distribution-list">
        {rows.map(([label, count, tone]) => (
          <div key={label}>
            <span><i className={`war-legend-dot ${tone}`} />{label}</span>
            <b>{count} ({Math.round(Number(count || 0) / total * 100)}%)</b>
          </div>
        ))}
      </div>
    </div>
  )
}

function Heatmap({ rows }) {
  return (
    <div className="war-heatmap">
      {(rows || []).map((row, index) => {
        const rate = Number(row.utilization_rate || 0)
        const tone = rate >= 90 ? 'hot' : rate >= 70 ? 'warm' : rate <= 45 ? 'cool' : 'ok'
        return (
          <div key={stableKey("heatmap", row, index)} className={`war-heatmap-cell ${tone}`}>
            <b>{row.cnc_machine_id}</b>
            <span>{formatPercent(rate, 0)}</span>
            <span>
              {row.status === 'ALARM' ? (
                <span style={{ color: 'red' }}>異常</span>
              ) : (
                row.ai_judgement
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SimpleTable({ columns, labels, rows, max = 8, emptyText = '目前沒有資料' }) {
  const visibleRows = max ? (rows || []).slice(0, max) : (rows || [])
  return (
    <div className="war-table-wrap">
      <table className="war-table">
        <thead>
          <tr>
            {columns.map((c) => <th key={c}>{labels[c] || c}</th>)}
          </tr>
        </thead>
        <tbody>
          {visibleRows.length ? visibleRows.map((row, index) => (
            <tr key={stableKey("table-row", row, index)}>
              {columns.map((c, colIndex) => <td key={`cell-${index}-${colIndex}-${c}`}>{row[c] ?? '-'}</td>)}
            </tr>
          )) : (
            <tr><td colSpan={columns.length}>{emptyText}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function DecisionAnalysis({ kpi, rewardStats }) {
  return (
    <div className="war-decision-grid">
      <KpiTile label="狀態變數" value="128" sub="維度" />
      <KpiTile label="可執行動作" value="56" sub="種" />
      <KpiTile label="今日決策次數" value={kpi.ai_reschedule_suggestions || 0} sub="DQN 建議" />
      <KpiTile label="平均 Reward" value={`${formatNumber(rewardStats.avgScore || 0, 1)} / 100`} sub="閉環學習" />
    </div>
  )
}

function ProductionProgressPanel({ progress, kpi }) {
  const done = Number(progress?.completed_orders ?? kpi.completed_work_orders ?? 0)
  const total = Math.max(Number(progress?.total_orders ?? kpi.total_work_orders ?? 0), 1)
  const scheduled = Number(progress?.scheduled_jobs ?? 0)
  const running = Number(progress?.running_count ?? kpi.running_count ?? 0)
  const delayRisk = Number(progress?.delayed_orders ?? kpi.delayed_work_orders ?? 0)
  const shortageRisk = Number(progress?.shortage_risk_orders ?? kpi.shortage_risk_orders ?? 0)
  const completionRate = Math.max(0, Math.min(100, Number(progress?.completion_rate ?? (done / total * 100))))
  const utilization = Math.max(0, Math.min(100, Number(progress?.utilization_rate ?? kpi.realtime_utilization_rate ?? 0)))
  const oee = Math.max(0, Math.min(100, Number(progress?.today_oee ?? kpi.today_oee ?? 0)))

  return (
    <div className="war-production-progress">
      <div className="war-production-head">
        <h3>今日生產進度</h3>
        <span>{done} / {total} 張</span>
      </div>
      <div className="war-production-rings">
        <MiniRing value={Math.round(completionRate)} label="完成" />
        <MiniRing value={Math.round(utilization)} label="稼動" />
        <MiniRing value={Math.round(oee)} label="OEE" />
      </div>
      <div className="war-progress-stack">
        <ProgressBar label="完成率" value={completionRate} colorClass="good" />
        <ProgressBar label="稼動率" value={utilization} colorClass="cool" />
        <ProgressBar label="今日 OEE" value={oee} colorClass="good" />
        <ProgressBar label="延遲風險" value={delayRisk} max={Math.max(total, 1)} colorClass={delayRisk > 0 ? 'warn' : 'good'} suffix="張" />
        <ProgressBar label="缺貨風險" value={shortageRisk} max={Math.max(total, 1)} colorClass={shortageRisk > 0 ? 'bad' : 'good'} suffix="張" />
      </div>
      <div className="war-production-foot">
        <span>排程筆數 <b>{scheduled}</b></span>
        <span>加工中 <b>{running}</b></span>
      </div>
    </div>
  )
}


function MiniTrendLine({ values = [], color = 'var(--aips-111-green)', height = 58 }) {
  const safeValues = (values && values.length ? values : [65, 68, 71, 70, 74, 78, 76, 80, 83, 81, 85, 88]).map((v) => Number(v || 0))
  const width = 220
  const min = Math.min(...safeValues)
  const max = Math.max(...safeValues)
  const range = Math.max(max - min, 1)
  const points = safeValues.map((value, index) => {
    const x = (index / Math.max(safeValues.length - 1, 1)) * width
    const y = height - 8 - ((value - min) / range) * (height - 16)
    return `${x},${y}`
  }).join(' ')
  const area = `0,${height - 4} ${points} ${width},${height - 4}`
  return (
    <svg className="aips-111-trend-line" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="aips111LineFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#aips111LineFill)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Aips111Table({ title, headers, rows, renderRow, className = '', emptyText = '目前沒有資料' }) {
  return (
    <section className={`aips-111-panel aips-111-table-panel ${className}`}>
      <h3>{title}</h3>
      <div className="aips-111-table-wrap">
        <table className="aips-111-table">
          <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {(rows || []).length ? rows.map(renderRow) : <tr><td colSpan={headers.length}>{emptyText}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AIBoardBottomBlock({ data, kpi, rewardStats, workOrders, lineStockRows, toolRows, alerts, onReschedule, onSimulate, loading }) {
  const bottom = data.ai_board_bottom || {}
  const learning = bottom.learning || {}
  const decision = bottom.decision_analysis || {}
  const schedule = bottom.schedule_summary || {}
  const reward = bottom.reward_snapshot || {}
  const simulation = bottom.reschedule_simulation || {}
  const orderRows = (bottom.work_order_rows && bottom.work_order_rows.length) ? bottom.work_order_rows : workOrders
  const materialRows = (bottom.material_rows && bottom.material_rows.length) ? bottom.material_rows : lineStockRows
  const toolStatusRows = (bottom.tool_rows && bottom.tool_rows.length) ? bottom.tool_rows : toolRows
  const alertRows = (bottom.alert_rows && bottom.alert_rows.length) ? bottom.alert_rows : alerts
  const trend = (reward.trend || learning.trend || [72, 74, 76, 79, 78, 82, 84, 83]).slice(-14)
  const learningScore = Number(learning.avg_reward_score ?? rewardStats.avgScore ?? 82)
  const progressRate = Math.max(0, Math.min(100, Number(learning.learning_progress_rate || 63)))
  const scheduleMetrics = [
    {
      label: '延遲工單',
      beforeText: `原 ${schedule.delayed_orders_before ?? 0} 張`,
      afterText: `現 ${schedule.delayed_orders_after ?? 0} 張`,
      delta: `${Number(schedule.delayed_orders_before || 0) > 0 ? '▼' : '—'} ${Number(schedule.delayed_orders_before || 0) > 0 ? formatPercent(Math.max(0, (Number(schedule.delayed_orders_before || 0) - Number(schedule.delayed_orders_after || 0)) / Math.max(Number(schedule.delayed_orders_before || 0), 1) * 100), 0) : '0%'}`,
      good: true,
      trend: [78, 72, 68, 60, 52, 45, 38, 32],
    },
    {
      label: '平均延遲時間',
      beforeText: `原 ${schedule.avg_delay_minutes_before ?? 0} 分鐘`,
      afterText: `現 ${schedule.avg_delay_minutes_after ?? 0} 分鐘`,
      delta: `${Number(schedule.avg_delay_minutes_before || 0) > 0 ? '▼' : '—'} ${Number(schedule.avg_delay_minutes_before || 0) > 0 ? formatPercent(Math.max(0, (Number(schedule.avg_delay_minutes_before || 0) - Number(schedule.avg_delay_minutes_after || 0)) / Math.max(Number(schedule.avg_delay_minutes_before || 0), 1) * 100), 0) : '0%'}`,
      good: true,
      trend: [88, 76, 70, 62, 52, 44, 36, 30],
    },
    {
      label: '稼動率',
      beforeText: `原 ${formatPercent(schedule.utilization_before ?? kpi.realtime_utilization_rate ?? 0, 0)}`,
      afterText: `現 ${formatPercent(schedule.utilization_after ?? kpi.realtime_utilization_rate ?? 0, 0)}`,
      delta: `▲ ${formatPercent(Math.max(0, Number(schedule.utilization_after || 0) - Number(schedule.utilization_before || 0)), 0)}`,
      good: true,
      trend: [42, 48, 50, 57, 61, 67, 72, 78],
    },
    {
      label: '缺貨風險',
      beforeText: `原 ${schedule.shortage_risk_before ?? 0} 件`,
      afterText: `現 ${schedule.shortage_risk_after ?? 0} 件`,
      delta: `${Number(schedule.shortage_risk_before || 0) > 0 ? '▼' : '—'} ${Number(schedule.shortage_risk_before || 0) > 0 ? formatPercent(Math.max(0, (Number(schedule.shortage_risk_before || 0) - Number(schedule.shortage_risk_after || 0)) / Math.max(Number(schedule.shortage_risk_before || 0), 1) * 100), 0) : '0%'}`,
      good: true,
      trend: [62, 56, 50, 45, 38, 28, 20, 10],
    },
  ]

  return (
    <div className="aips-111-bottom-grid">
      <Aips111Table
        title="即時工單清單"
        className="aips-111-workorders"
        headers={['工單編號', '產品名稱', '數量', '已完成', '進度', '負責機台', '狀態', 'DQN']}
        rows={(orderRows || []).slice(0, 6)}
        renderRow={(row, index) => (
          <tr key={stableKey('aips111-workorder', row, index)}>
            <td>{row.work_order_no || '-'}</td>
            <td>{row.product_no || row.product_name || '-'}</td>
            <td>{row.planned_qty || row.qty || '-'}</td>
            <td>{row.completed_qty ?? row.done ?? 0}</td>
            <td>{row.progress_pct !== undefined ? `${formatNumber(row.progress_pct, 0)}%` : row.progress || '-'}</td>
            <td>{row.cnc_machine_id || row.assigned_cnc_machine_id || '-'}</td>
            <td><span className={`aips-111-badge ${String(row.status || '').includes('瓶頸') ? 'danger' : 'ok'}`}>{row.status || '加工中'}</span></td>
            <td className="aips-111-score-cell">{row.dqn_score || '-'}</td>
          </tr>
        )}
      />

      <Aips111Table
        title="物料狀態（線邊庫）"
        className="aips-111-materials"
        headers={['物料名稱', '庫存量', '可用量', '安全庫存', '狀態', '對應影響']}
        rows={(materialRows || []).slice(0, 5)}
        renderRow={(row, index) => {
          const shortage = Number(row.shortage_qty || 0)
          return <tr key={stableKey('aips111-material', row, index)}>
            <td>{row.material_no || '-'}</td>
            <td>{row.current_qty ?? '-'}</td>
            <td>{row.available_qty ?? '-'}</td>
            <td>{row.safety_stock_qty ?? '-'}</td>
            <td><span className={`aips-111-text-${shortage > 0 ? 'warn' : 'ok'}`}>{shortage > 0 ? '不足' : '正常'}</span></td>
            <td>{row.ai_judgement || '-'}</td>
          </tr>
        }}
      />

      <Aips111Table
        title="刀具狀態"
        className="aips-111-tools"
        headers={['刀具編號', '剩餘壽命', '狀態', '建議動作']}
        rows={(toolStatusRows || []).slice(0, 5)}
        renderRow={(row, index) => <tr key={stableKey('aips111-tool', row, index)}>
          <td>{row.tool_no || '-'}</td>
          <td>{typeof row.remaining_life_rate === 'number' ? `${formatNumber(row.remaining_life_rate, 0)}%` : row.remaining_life_rate}</td>
          <td><span className={`aips-111-text-${String(row.risk_level || '').includes('危') ? 'danger' : String(row.risk_level || '').includes('預') ? 'warn' : 'ok'}`}>{row.risk_level || '正常'}</span></td>
          <td>{row.suggested_action || '-'}</td>
        </tr>}
      />

      <Aips111Table
        title="即時異常與預警"
        className="aips-111-alerts"
        headers={['機台', '嚴重度', '異常類型', '說明']}
        rows={(alertRows || []).slice(0, 5)}
        renderRow={(row, index) => <tr key={stableKey('aips111-alert', row, index)}>
          <td>{row.cnc_machine_id || row.machine || '-'}</td>
          <td><span className={`aips-111-text-${String(row.alert_level || row.level || '').includes('HIGH') || String(row.level || '').includes('高') ? 'danger' : 'warn'}`}>{row.alert_level || row.level || '-'}</span></td>
          <td>{row.alert_reason || row.type || '-'}</td>
          <td>{row.status || row.desc || '-'}</td>
        </tr>}
      />

      <section className="aips-111-panel aips-111-schedule-summary aips-112-stock-summary">
        <h3>今日排程績效（AI重排 vs 原排程）</h3>
        <div className="aips-112-stock-grid">
          {scheduleMetrics.map((item, index) => (
            <div key={`stock-metric-${item.label}`} className="aips-112-stock-card">
              <div className="aips-112-stock-head">
                <span>{item.label}</span>
                <em className={item.good ? 'good' : 'bad'}>{item.delta}</em>
              </div>
              <div className="aips-112-stock-values">
                <b>{item.beforeText}</b>
                <i>→</i>
                <b>{item.afterText}</b>
              </div>
              <MiniTrendLine values={item.trend} color={item.good ? 'var(--aips-111-green)' : 'var(--aips-111-red)'} height={34} />
            </div>
          ))}
        </div>
      </section>

      <section className="aips-111-panel aips-111-reward">
        <h3>Reward 總分</h3>
        <div className="aips-111-reward-box">
          <span className="aips-111-trophy">🏆</span>
          <strong>{formatNumber(reward.score ?? rewardStats.avgScore ?? 82, 1)}<em>/100</em></strong>
        </div>
        <MiniTrendLine values={trend} color="var(--aips-111-cyan)" height={52} />
      </section>

      <section className="aips-111-panel aips-111-reschedule">
        <div className="aips-112-reschedule-head">
          <h3>重排程模擬</h3>
          <button type="button" className="aips-112-sim-button" onClick={onSimulate || onReschedule} disabled={loading}>{loading ? '計算中...' : '模擬運算'}</button>
        </div>
        <select defaultValue="urgent"><option value="urgent">情境：加入急單</option></select>
        <div className="aips-111-sim-result">
          <span>模擬結果：<b>{simulation.status || '可行'}</b></span>
          <span>預計延遲時間：<b>{simulation.bottleneck_minutes ?? 15} 分鐘</b></span>
          <span>建議：<b>{simulation.recommended_window || 'CNC-02 14:00 時段'}</b></span>
        </div>
        <button type="button" onClick={onReschedule} disabled={loading}>{loading ? '處理中...' : '套用重排'}</button>
      </section>
    </div>
  )
}

function RewardTrendChart({ rows, events }) {
  const trendRows = (rows || []).slice(0, 36).reverse()
  const values = trendRows.map((row) => Number(row.reward_score || 0))
  if (!values.length) {
    return <div className="war-chart-empty">目前沒有 Reward 資料，請先計算 Reward。</div>
  }

  const width = 880
  const height = 300
  const leftPad = 34
  const rightPad = 20
  const topPad = 28
  const bottomPad = 32
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 100)
  const range = Math.max(max - min, 1)
  const usableWidth = width - leftPad - rightPad
  const usableHeight = height - topPad - bottomPad

  const pointObjects = values.map((value, index) => {
    const x = leftPad + (index / Math.max(values.length - 1, 1)) * usableWidth
    const y = topPad + (1 - ((value - min) / range)) * usableHeight
    return { x, y, value, index, row: trendRows[index] }
  })

  const points = pointObjects.map((p) => `${p.x},${p.y}`).join(' ')
  const areaPoints = `${leftPad},${height - bottomPad} ${points} ${width - rightPad},${height - bottomPad}`

  const movingAvgObjects = pointObjects.map((_, index) => {
    const start = Math.max(0, index - 4)
    const chunk = values.slice(start, index + 1)
    const avg = chunk.reduce((sum, v) => sum + v, 0) / Math.max(chunk.length, 1)
    const x = pointObjects[index].x
    const y = topPad + (1 - ((avg - min) / range)) * usableHeight
    return { x, y }
  })
  const movingAvgPoints = movingAvgObjects.map((p) => `${p.x},${p.y}`).join(' ')

  const highest = Math.max(...values)
  const lowest = Math.min(...values)
  const highY = topPad + (1 - ((highest - min) / range)) * usableHeight
  const lowY = topPad + (1 - ((lowest - min) / range)) * usableHeight

  const eventRows = (events || []).map((event, index) => {
    const color = REWARD_EVENT_COLORS[index % REWARD_EVENT_COLORS.length]
    const matchIndex = trendRows.findIndex((row) => String(row.reward_time || row.calculated_at || '') === String(event.reward_time || event.calculated_at || ''))
    const fallbackIndex = Math.round((index / Math.max((events || []).length - 1, 1)) * Math.max(trendRows.length - 1, 0))
    const point = pointObjects[matchIndex >= 0 ? matchIndex : fallbackIndex] || pointObjects[pointObjects.length - 1]
    return { ...event, markerNo: index + 1, color, point }
  })

  return (
    <div className="war-chart-card">
      <div className="war-chart-head">
        <div>
          <h3>Reward 分數趨勢（即時）</h3>
          <p>依最近 Reward 記錄繪製分數曲線，並以事件標記 1~6 對應下方 Action 時間軸。</p>
        </div>
        <div className="war-chart-tags">
          <span>Reward 總分</span>
          <span>移動平均 (5)</span>
          <span>最佳 / 最低</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="war-reward-svg" preserveAspectRatio="none">
        {[0, 25, 50, 75, 100].map((line) => {
          const y = topPad + (1 - ((line - min) / range)) * usableHeight
          return (
            <g key={line}>
              <line x1={leftPad} y1={y} x2={width - rightPad} y2={y} className="grid-line" />
              <text x={4} y={y + 4} className="axis-label">{line}</text>
            </g>
          )
        })}

        <line x1={leftPad} y1={highY} x2={width - rightPad} y2={highY} className="high-line" />
        <line x1={leftPad} y1={lowY} x2={width - rightPad} y2={lowY} className="low-line" />

        <polyline points={areaPoints} className="reward-area" />
        <polyline points={movingAvgPoints} className="moving-line" />
        <polyline points={points} className="reward-line" />

        {pointObjects.map((p, idx) => (
          <circle key={`dot-${idx}`} cx={p.x} cy={p.y} r="2.4" className="reward-dot" />
        ))}

        {eventRows.map((event) => (
          <g key={`event-${event.markerNo}-${event.point.index}-${event.point.x}`}>
            <line
              x1={event.point.x}
              y1={topPad + 4}
              x2={event.point.x}
              y2={event.point.y - 8}
              stroke={event.color.stroke}
              strokeWidth="1.8"
              strokeDasharray="4 4"
              opacity="0.92"
            />
            <circle cx={event.point.x} cy={topPad - 1} r="10" fill={event.color.fill} stroke="#e2e8f0" strokeWidth="1.6" />
            <text x={event.point.x} y={topPad + 3} textAnchor="middle" className="event-marker-text">{event.markerNo}</text>
          </g>
        ))}
      </svg>
      <div className="war-chart-xaxis">
        {pointObjects.filter((_, idx) => idx % Math.max(Math.floor(pointObjects.length / 6), 1) === 0 || idx === pointObjects.length - 1).map((p, idx) => (
          <span key={`time-${idx}`}>{String(p.row.reward_time || p.row.calculated_at || '').slice(11, 16) || `#${p.index + 1}`}</span>
        ))}
      </div>
    </div>
  )
}

function RewardDistribution({ stats }) {
  return (
    <div className="war-panel war-distribution-panel">
      <h3>Reward 分數分布（最近 24 小時）</h3>
      <div className="war-distribution-bars">
        {stats.distribution.map((item) => (
          <div className="war-distribution-bar" key={item.label}>
            <span>{item.label}</span>
            <div className="war-progress-track"><i className={item.cls} style={{ width: `${item.pct}%` }} /></div>
            <b>{formatPercent(item.pct, 1)}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

function RewardComposition({ stats }) {
  return (
    <div className="war-panel war-distribution-panel">
      <h3>Reward 構成占比（平均）</h3>
      <div className="war-distribution-bars">
        {stats.composition.map((item) => (
          <div className="war-distribution-bar" key={item.label}>
            <span>{item.label}</span>
            <div className="war-progress-track"><i className={item.cls} style={{ width: `${item.pct}%` }} /></div>
            <b>{formatPercent(item.pct, 1)}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

function RewardTimeline({ rows }) {
  const visible = (rows || []).slice(0, 6)
  return (
    <div className="war-timeline-section">
      <div className="war-timeline-track">
        <i />
        {visible.map((row, index) => {
          const color = REWARD_EVENT_COLORS[index % REWARD_EVENT_COLORS.length]
          return (
            <span
              key={`track-${row.reward_id || row.reward_log_id || row.work_order_no || "event"}-${index}`}
              className="war-track-node"
              style={{ '--node-fill': color.fill, '--node-stroke': color.stroke }}
            >
              {index + 1}
            </span>
          )
        })}
      </div>
      <div className="war-timeline-grid">
        {visible.length ? visible.map((row, index) => {
          const color = REWARD_EVENT_COLORS[index % REWARD_EVENT_COLORS.length]
          return (
            <div key={`${row.reward_id || row.reward_log_id || row.work_order_no || "event"}-${index}`} className={`war-event-card tone-${row.delta >= 0 ? 'good' : 'bad'}`}>
              <div className="war-event-head">
                <strong>{String(row.reward_time || row.calculated_at || '').slice(11, 19) || '--:--:--'}</strong>
                <span>{row.action_name || row.action_type || 'DQN Action'}</span>
              </div>
              <div className="war-event-body">
                <div>工單：{row.work_order_no || '-'}</div>
                <div>機台：{row.cnc_machine_id || row.machine_id || '-'}</div>
                <div>Scope：{scopeText(row.reward_scope)}</div>
              </div>
              <div className="war-event-score">
                <b>Reward：{formatNumber(row.reward_score || 0, 1)}</b>
                <em>{row.delta >= 0 ? '+' : ''}{formatNumber(row.delta || 0, 1)}</em>
              </div>
            </div>
          )
        }) : <div className="war-chart-empty">目前沒有 Reward 事件資料。</div>}
      </div>
    </div>
  )
}

function sectionTitle(title, subtitle) {
  return (
    <div className="war-section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  )
}

export default function CncDashboardPanel() {
  const [scheduleDate, setScheduleDate] = useState(todayText())
  const [selectedCnc, setSelectedCnc] = useState('ALL')
  const [viewMode, setViewMode] = useState('week')
  const [activeTab, setActiveTab] = useState('ai_board')
  const [nowText, setNowText] = useState(formatDateTime())
  const [aiBoardColumns, setAiBoardColumns] = useState(() => {
    try {
      const saved = window.localStorage.getItem('aips-ai-board-resizable-columns')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          left: Math.max(190, Math.min(380, Number(parsed.left || 238))),
          right: Math.max(260, Math.min(520, Number(parsed.right || 304))),
        }
      }
    } catch (err) {
      // localStorage unavailable: keep default.
    }
    return { left: 238, right: 304 }
  })
  const [data, setData] = useState({ cards: [], kpi: {}, gantt_rows: [], ai_suggestions: [], alerts: [], line_stock_rows: [], maintenance_rows: [], heatmap_rows: [] })
  const [rewards, setRewards] = useState([])
  const [rewardLogDashboard, setRewardLogDashboard] = useState({ summary: {}, logs: [], distribution: [], composition: [], timeline: [] })
  const [workOrderRows, setWorkOrderRows] = useState([])
  const [inventoryRows, setInventoryRows] = useState([])
  const [actionRows, setActionRows] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [rewardFilters, setRewardFilters] = useState({
    timeRange: '24h',
    runId: 'ALL',
    scope: 'ALL',
    actionType: 'ALL',
  })
  const [rewardDraftFilters, setRewardDraftFilters] = useState({
    timeRange: '24h',
    runId: 'ALL',
    scope: 'ALL',
    actionType: 'ALL',
  })

  const aiBoardGridStyle = {
    '--aips-ai-left-col': `${aiBoardColumns.left}px`,
    '--aips-ai-right-col': `${aiBoardColumns.right}px`,
  }

  function startAiBoardColumnDrag(targetColumn, event) {
    const pointerEvent = event.nativeEvent || event
    const startX = pointerEvent.clientX
    const startColumns = { ...aiBoardColumns }
    if (!Number.isFinite(startX)) return

    event.preventDefault()
    document.body.classList.add('aips-ai-board-resizing')

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX
      setAiBoardColumns(() => {
        const next = targetColumn === 'left'
          ? {
            left: Math.max(190, Math.min(380, startColumns.left + dx)),
            right: startColumns.right,
          }
          : {
            left: startColumns.left,
            right: Math.max(260, Math.min(520, startColumns.right - dx)),
          }

        try {
          window.localStorage.setItem('aips-ai-board-resizable-columns', JSON.stringify(next))
        } catch (err) {
          // ignore localStorage write failure
        }
        return next
      })
    }

    const stopDrag = () => {
      document.body.classList.remove('aips-ai-board-resizing')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stopDrag)
      window.removeEventListener('pointercancel', stopDrag)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stopDrag)
    window.addEventListener('pointercancel', stopDrag)
  }

  function resetAiBoardColumns() {
    const defaults = { left: 238, right: 304 }
    setAiBoardColumns(defaults)
    try {
      window.localStorage.setItem('aips-ai-board-resizable-columns', JSON.stringify(defaults))
    } catch (err) {
      // ignore localStorage write failure
    }
  }

  function buildRewardDashboardQuery(filters = rewardFilters) {
    const params = new URLSearchParams({ limit: '120' })
    if (filters.timeRange && filters.timeRange !== 'ALL') params.set('time_range', filters.timeRange)
    if (filters.runId && filters.runId !== 'ALL') params.set('schedule_run_id', filters.runId)
    if (filters.scope && filters.scope !== 'ALL') params.set('reward_scope', filters.scope)
    if (filters.actionType && filters.actionType !== 'ALL') params.set('action_type', filters.actionType)
    return params.toString()
  }

  async function loadRewardLogDashboard(filters = rewardFilters) {
    const query = buildRewardDashboardQuery(filters)
    const res = await apiClient.get(`/aips/reward-log/dashboard?${query}`)
    setRewardLogDashboard(res.data || { summary: {}, logs: [], distribution: [], composition: [], timeline: [] })
    return res.data
  }

  async function load(targetDate = scheduleDate) {
    setLoading(true)
    setMessage('')
    const requests = await Promise.allSettled([
      apiClient.get(`/aips/cnc-dashboard/summary?schedule_date=${targetDate}`),
      apiClient.get('/aips/rewards/latest?limit=120'),
      apiClient.get(`/aips/reward-log/dashboard?${buildRewardDashboardQuery({ timeRange: 'ALL', runId: 'ALL', scope: 'ALL', actionType: 'ALL' })}`),
      apiClient.get('/work-orders/snapshots/latest'),
      apiClient.get('/inventory/snapshots/latest'),
      apiClient.get('/aips/dqn/actions/latest?limit=120'),
    ])

    const [summaryRes, rewardRes, rewardLogRes, woRes, invRes, actionRes] = requests

    if (summaryRes.status === 'fulfilled') {
      setData(summaryRes.value.data || { cards: [], kpi: {}, gantt_rows: [], ai_suggestions: [], alerts: [], line_stock_rows: [], maintenance_rows: [], heatmap_rows: [] })
    } else {
      setData({ cards: [], kpi: {}, gantt_rows: [], ai_suggestions: [], alerts: [], line_stock_rows: [], maintenance_rows: [], heatmap_rows: [] })
      setMessage(summaryRes.reason?.response?.data?.detail || summaryRes.reason?.message || 'Dashboard 載入失敗')
    }

    setRewards(rewardRes.status === 'fulfilled' ? (rewardRes.value.data || []) : [])
    setRewardLogDashboard(rewardLogRes.status === 'fulfilled' ? (rewardLogRes.value.data || { summary: {}, logs: [], distribution: [], composition: [], timeline: [] }) : { summary: {}, logs: [], distribution: [], composition: [], timeline: [] })
    setWorkOrderRows(woRes.status === 'fulfilled' ? (woRes.value.data || []) : [])
    setInventoryRows(invRes.status === 'fulfilled' ? (invRes.value.data || []) : [])
    setActionRows(actionRes.status === 'fulfilled' ? (actionRes.value.data || []) : [])
    setLoading(false)
  }

  async function aiReschedule() {
    setLoading(true)
    try {
      let res
      try {
        res = await apiClient.post(`/aips/cnc-dashboard/ai-reschedule?schedule_date=${scheduleDate}`, {}, { timeout: 60000 })
      } catch (firstErr) {
        if (firstErr?.response?.status === 404) {
          try {
            res = await apiClient.get(`/aips/cnc-dashboard/ai-reschedule?schedule_date=${scheduleDate}`, { timeout: 60000 })
          } catch (secondErr) {
            if (secondErr?.response?.status === 404) {
              res = await apiClient.post(`/aips/cnc-dashboard/reschedule?schedule_date=${scheduleDate}`, {}, { timeout: 60000 })
            } else {
              throw secondErr
            }
          }
        } else {
          throw firstErr
        }
      }

      const cmp = res.data.comparison || {}
      setMessage(`AI 重排完成：延遲工單 ${cmp.delayed_orders_before ?? 0} → ${cmp.delayed_orders_after ?? 0}，缺貨風險 ${cmp.shortage_risk_before ?? 0} → ${cmp.shortage_risk_after ?? 0}`)
      await load(scheduleDate)
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'AI 一鍵重排失敗'
      setMessage(detail)
      alert(detail)
    } finally {
      setLoading(false)
    }
  }

  async function simulateReschedulePreview() {
    setLoading(true)
    try {
      const res = await apiClient.get(`/aips/cnc-dashboard/simulate-reschedule?schedule_date=${scheduleDate}`, { timeout: 60000 })
      const cmp = res.data.comparison || {}
      setMessage(`模擬運算完成：延遲工單 ${cmp.delayed_orders_before ?? 0} → ${cmp.delayed_orders_after ?? 0}，平均延遲 ${cmp.avg_delay_minutes_before ?? 0} → ${cmp.avg_delay_minutes_after ?? 0} 分鐘。`)
      if (res.data.dashboard) {
        setData(res.data.dashboard)
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || '模擬運算失敗'
      setMessage(detail)
      alert(detail)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(scheduleDate)
    const timer = setInterval(() => setNowText(formatDateTime()), 1000)
    return () => clearInterval(timer)
  }, [])

  const cards = data.cards || []
  const kpi = data.kpi || {}
  const productionProgress = data.production_progress || {}
  const cncOptions = ['ALL', ...Array.from(new Set(cards.map((c) => c.cnc_machine_id).filter(Boolean))).sort()]
  const filteredCards = selectedCnc === 'ALL' ? cards : cards.filter((c) => c.cnc_machine_id === selectedCnc)
  const filteredGantt = selectedCnc === 'ALL' ? (data.gantt_rows || []) : (data.gantt_rows || []).filter((r) => r.cnc_machine_id === selectedCnc)
  const filteredHeatmap = selectedCnc === 'ALL' ? (data.heatmap_rows || []) : (data.heatmap_rows || []).filter((r) => r.cnc_machine_id === selectedCnc)
  const filteredAlerts = selectedCnc === 'ALL' ? (data.alerts || []) : (data.alerts || []).filter((r) => r.cnc_machine_id === selectedCnc)
  const filteredLineStock = selectedCnc === 'ALL' ? (data.line_stock_rows || []) : (data.line_stock_rows || []).filter((r) => r.cnc_machine_id === selectedCnc)
  const filteredWorkOrders = selectedCnc === 'ALL'
    ? (workOrderRows.length ? workOrderRows : (data.gantt_rows || []))
    : (workOrderRows.length ? workOrderRows.filter((row) => row.assigned_cnc_machine_id === selectedCnc) : (data.gantt_rows || []).filter((r) => r.cnc_machine_id === selectedCnc))

  const uniqueWorkOrders = useMemo(() => {
    const source = filteredWorkOrders.length ? filteredWorkOrders : (data.gantt_rows || [])
    const map = new Map()
    source.forEach((row, index) => {
      const key = row.work_order_no || `${row.product_no || 'P'}-${index}`
      if (!map.has(key)) {
        map.set(key, {
          work_order_no: row.work_order_no || '-',
          product_no: row.product_no || row.product_code || '-',
          product_name: row.product_name || '-',
          planned_qty: row.planned_qty || row.qty || '-',
          remaining_qty: row.remaining_qty || row.shortage_qty || '-',
          priority_level: row.priority_level || '-',
          assigned_cnc_machine_id: row.assigned_cnc_machine_id || row.cnc_machine_id || '-',
          due_date: row.due_date || row.end_time_text || '-',
          delay_risk_flag: row.delay_risk_flag ?? row.schedule_status === 'OVER_CAPACITY',
        })
      }
    })
    return Array.from(map.values())
  }, [filteredWorkOrders, data.gantt_rows])

  const workOrders = useMemo(() => (data.gantt_rows || []).map((row) => ({
    ...row,
    progress: row.schedule_status === 'OVER_CAPACITY' ? '延遲風險' : '加工中',
    dqn_score: Math.round(75 + Math.random() * 20),
  })), [data.gantt_rows])

  const toolRows = useMemo(() => filteredCards.map((card, index) => {
    const remaining = Math.max(5, Math.round(Number(card.tool_life_remaining_rate || 0.75) * 100))
    const abnormal = Number(card.abnormal_probability || 0)
    const risk = abnormal >= 0.75 ? '高' : abnormal >= 0.45 ? '中' : '低'
    const action = abnormal >= 0.75 ? '立即更換 / 安排保養' : abnormal >= 0.45 ? '預警，排程前檢查' : '正常使用'
    return {
      cnc_machine_id: card.cnc_machine_id,
      tool_no: `T${pad2(index + 1)}`,
      remaining_life_rate: `${remaining}%`,
      risk_level: risk,
      suggested_action: action,
      abnormal_signal: card.alert_reason || '正常',
      utilization_rate: formatPercent(card.utilization_rate || 0, 0),
      current_work_order_no: card.current_work_order_no || '-',
    }
  }), [filteredCards])

  const rewardRows = useMemo(() => {
    const logRows = rewardLogDashboard.logs || []
    if (logRows.length) {
      return logRows.map((row) => ({
        ...row,
        reward_id: row.reward_log_id,
        reward_time: row.calculated_at,
        work_order_no: row.work_order_no,
        cnc_machine_id: row.machine_id,
        action_name: row.action_name,
        action_type: row.action_code,
        reward_score: Number(row.reward_score || 0),
        reward_before: Number(row.reward_before || 0),
        reward_after: Number(row.reward_after || 0),
        delta: Number(row.reward_delta || 0),
        q_value: Number(row.q_value || 0).toFixed(3),
        confidence_pct: `${Number(row.confidence_score || 0).toFixed(0)}%`,
      }))
    }
    return rewards.map((row, index) => {
      const action = actionRows.find((item) => String(item.action_id) === String(row.action_id)) || {}
      const rewardScore = Number(row.reward_score || 0)
      const before = Math.max(0, rewardScore - (index % 2 === 0 ? 6.4 : -3.2))
      const after = rewardScore
      const delta = after - before
      const scope = row.cnc_machine_id ? 'MACHINE' : row.work_order_no ? 'WORK_ORDER' : 'SCHEDULE_GLOBAL'
      return {
        ...row,
        ...action,
        schedule_run_id: `DQN-RUN-${String(row.reward_time || '').slice(0, 10).replace(/-/g, '') || 'DEMO'}-0001`,
        decision_step_no: index + 1,
        reward_scope: scope,
        reward_before: formatNumber(before, 1),
        reward_after: formatNumber(after, 1),
        delta,
        q_value: formatNumber(Math.max(0.61, Math.min(0.98, rewardScore / 100 + 0.04)), 2),
        confidence_pct: formatPercent(Number(action.action_confidence_score || 0.85) * 100, 0),
        action_name: action.action_name || action.action_type || 'AI 決策',
        action_type: action.action_type || 'DQN_ACTION',
      }
    })
  }, [rewards, actionRows, rewardLogDashboard])

  const rewardStats = useMemo(() => {
    const rows = rewardRows
    const scores = rows.map((row) => Number(row.reward_score || 0))
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const current = scores[0] || 0
    const maxScore = scores.length ? Math.max(...scores) : 0
    const minScore = scores.length ? Math.min(...scores) : 0
    const distributionRanges = [
      { label: '90 ~ 100（優秀）', min: 90, max: 100, cls: 'good' },
      { label: '80 ~ 90（良好）', min: 80, max: 90, cls: 'cool' },
      { label: '70 ~ 80（普通）', min: 70, max: 80, cls: 'warn' },
      { label: '60 ~ 70（偏低）', min: 60, max: 70, cls: 'warm' },
      { label: '< 60（不佳）', min: -999, max: 60, cls: 'bad' },
    ]
    const distribution = distributionRanges.map((range) => {
      const count = scores.filter((value) => value >= range.min && value < range.max).length
      const pct = scores.length ? count / scores.length * 100 : 0
      return { ...range, count, pct }
    })
    const totals = rows.reduce((acc, row) => {
      acc.shortage += Number(row.reward_shortage_score || 0)
      acc.delivery += Number(row.reward_delivery_score || 0)
      acc.oee += Number(row.reward_oee_score || 0)
      acc.quality += Number(row.reward_quality_score || 0)
      acc.energy += Number(row.reward_energy_score || 0)
      return acc
    }, { shortage: 0, delivery: 0, oee: 0, quality: 0, energy: 0 })
    const sum = totals.shortage + totals.delivery + totals.oee + totals.quality + totals.energy || 1
    const composition = [
      { label: '避免缺貨', pct: totals.shortage / sum * 100, cls: 'good' },
      { label: '準時交貨', pct: totals.delivery / sum * 100, cls: 'cool' },
      { label: 'OEE 提升', pct: totals.oee / sum * 100, cls: 'warn' },
      { label: '品質風險', pct: totals.quality / sum * 100, cls: 'violet' },
      { label: '減少換線時間 / 能耗', pct: totals.energy / sum * 100, cls: 'orange' },
    ]
    const backendSummary = rewardLogDashboard.summary || {}
    const backendDistribution = rewardLogDashboard.distribution || []
    const backendComposition = rewardLogDashboard.composition || []
    return {
      current: backendSummary.current_reward ?? current,
      avgScore: backendSummary.avg_reward ?? avgScore,
      maxScore: backendSummary.max_reward ?? maxScore,
      minScore: backendSummary.min_reward ?? minScore,
      distribution: backendDistribution.length ? backendDistribution : distribution,
      composition: backendComposition.length ? backendComposition : composition,
      actionCount: backendSummary.action_count ?? actionRows.length,
      autoActionCount: backendSummary.auto_action_count ?? Math.max(0, Math.round(actionRows.length * 0.75)),
      manualActionCount: backendSummary.manual_action_count ?? Math.max(0, actionRows.length - Math.round(actionRows.length * 0.75)),
    }
  }, [rewardRows, actionRows, rewardLogDashboard])


  const rewardTimelineRows = useMemo(() => {
    const source = rewardLogDashboard.timeline?.length ? rewardLogDashboard.timeline : rewardRows
    const chronological = [...(source || [])].slice(0, 24).reverse()
    if (chronological.length <= 6) return chronological
    const indexes = Array.from({ length: 6 }, (_, i) => Math.round((chronological.length - 1) * i / 5))
    return indexes.map((idx) => chronological[idx]).filter(Boolean)
  }, [rewardLogDashboard, rewardRows])

  const comparisonRows = data.reschedule_comparison ? [
    { metric: '延遲工單', original: `${data.reschedule_comparison.delayed_orders_before} 張`, dqn: `${data.reschedule_comparison.delayed_orders_after} 張`, improvement: `-${data.reschedule_comparison.delayed_orders_improvement} 張` },
    { metric: '平均延遲時間', original: `${data.reschedule_comparison.avg_delay_minutes_before} 分`, dqn: `${data.reschedule_comparison.avg_delay_minutes_after} 分`, improvement: '降低' },
    { metric: '平均稼動率', original: `${data.reschedule_comparison.avg_utilization_before}%`, dqn: `${data.reschedule_comparison.avg_utilization_after}%`, improvement: '提升' },
    { metric: '缺料風險', original: `${data.reschedule_comparison.shortage_risk_before} 件`, dqn: `${data.reschedule_comparison.shortage_risk_after} 件`, improvement: `-${data.reschedule_comparison.shortage_risk_improvement} 件` },
  ] : []

  const rewardRunOptions = useMemo(() => {
    const values = Array.from(new Set((rewardRows || []).map((row) => row.schedule_run_id).filter(Boolean)))
    return values
  }, [rewardRows])

  const rewardActionTypeOptions = useMemo(() => {
    const values = Array.from(new Set((rewardRows || []).map((row) => row.action_type || row.action_name).filter(Boolean)))
    return values
  }, [rewardRows])

  const filteredRewardRows = useMemo(() => {
    let rows = [...(rewardRows || [])]
    const latestMs = rows.reduce((max, row) => {
      const value = Date.parse(row.reward_time || row.calculated_at || '')
      return Number.isFinite(value) ? Math.max(max, value) : max
    }, 0)

    if (rewardFilters.timeRange !== 'ALL' && latestMs > 0) {
      const rangeHours = { '6h': 6, '12h': 12, '24h': 24, '7d': 168 }[rewardFilters.timeRange] || 24
      const minMs = latestMs - rangeHours * 60 * 60 * 1000
      rows = rows.filter((row) => {
        const value = Date.parse(row.reward_time || row.calculated_at || '')
        return !Number.isFinite(value) || value >= minMs
      })
    }

    if (rewardFilters.runId !== 'ALL') {
      rows = rows.filter((row) => String(row.schedule_run_id || '') === String(rewardFilters.runId))
    }

    if (rewardFilters.scope !== 'ALL') {
      rows = rows.filter((row) => String(row.reward_scope || '') === String(rewardFilters.scope))
    }

    if (rewardFilters.actionType !== 'ALL') {
      rows = rows.filter((row) => String(row.action_type || row.action_name || '') === String(rewardFilters.actionType))
    }

    return rows
  }, [rewardRows, rewardFilters])

  const filteredRewardStats = useMemo(() => {
    const rows = filteredRewardRows
    const scores = rows.map((row) => Number(row.reward_score || row.reward_after || 0)).filter((v) => Number.isFinite(v))
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const current = scores.length ? scores[0] : 0
    const maxScore = scores.length ? Math.max(...scores) : 0
    const minScore = scores.length ? Math.min(...scores) : 0
    const distributionRanges = [
      { label: '90 ~ 100（優秀）', min: 90, max: 101, cls: 'good' },
      { label: '80 ~ 90（良好）', min: 80, max: 90, cls: 'cool' },
      { label: '70 ~ 80（普通）', min: 70, max: 80, cls: 'warn' },
      { label: '60 ~ 70（偏低）', min: 60, max: 70, cls: 'warm' },
      { label: '< 60（不佳）', min: -999, max: 60, cls: 'bad' },
    ]
    const distribution = distributionRanges.map((range) => {
      const count = scores.filter((value) => value >= range.min && value < range.max).length
      const pct = scores.length ? count / scores.length * 100 : 0
      return { ...range, count, pct }
    })
    const totals = rows.reduce((acc, row) => {
      acc.shortage += Number(row.reward_shortage_score || 0)
      acc.delivery += Number(row.reward_delivery_score || 0)
      acc.oee += Number(row.reward_oee_score || 0)
      acc.quality += Number(row.reward_quality_score || 0)
      acc.energy += Number(row.reward_energy_score || 0)
      return acc
    }, { shortage: 0, delivery: 0, oee: 0, quality: 0, energy: 0 })
    const sum = totals.shortage + totals.delivery + totals.oee + totals.quality + totals.energy || 1
    const composition = [
      { label: '避免缺貨', pct: totals.shortage / sum * 100, cls: 'good' },
      { label: '準時交貨', pct: totals.delivery / sum * 100, cls: 'cool' },
      { label: 'OEE 提升', pct: totals.oee / sum * 100, cls: 'warn' },
      { label: '品質風險', pct: totals.quality / sum * 100, cls: 'violet' },
      { label: '減少換線時間 / 能耗', pct: totals.energy / sum * 100, cls: 'orange' },
    ]
    return {
      current,
      avgScore,
      maxScore,
      minScore,
      distribution,
      composition,
      actionCount: rows.length,
      autoActionCount: rows.filter((row) => (row.action_status || '').toLowerCase().includes('auto') || row.auto_execute_flag === true).length,
      manualActionCount: rows.filter((row) => !((row.action_status || '').toLowerCase().includes('auto') || row.auto_execute_flag === true)).length,
    }
  }, [filteredRewardRows])

  const filteredRewardTimelineRows = useMemo(() => {
    const source = rewardLogDashboard.timeline?.length ? filteredRewardRows : filteredRewardRows
    const chronological = [...(source || [])].slice(0, 24).reverse()
    if (chronological.length <= 6) return chronological
    const indexes = Array.from({ length: 6 }, (_, i) => Math.round((chronological.length - 1) * i / 5))
    return indexes.map((idx) => chronological[idx]).filter(Boolean)
  }, [filteredRewardRows, rewardLogDashboard])

  const rewardImprovementRows = useMemo(() => {
    const rows = filteredRewardRows
    const positive = rows.filter((row) => Number(row.delta || 0) > 0)
    const negative = rows.filter((row) => Number(row.delta || 0) < 0)
    const avgDelta = rows.length ? rows.reduce((sum, row) => sum + Number(row.delta || 0), 0) / rows.length : 0
    const avgOee = rows.length ? rows.reduce((sum, row) => sum + Number(row.reward_oee_score || 0), 0) / rows.length : 0
    return [
      { label: '正向改善事件', value: `${positive.length} 筆`, delta: `${positive.length ? '+' : ''}${positive.length}` },
      { label: '需持續追蹤事件', value: `${negative.length} 筆`, delta: `${negative.length ? '-' : ''}${negative.length}` },
      { label: '平均 Reward 改善', value: formatNumber(avgDelta, 1), delta: `${avgDelta >= 0 ? '+' : ''}${formatNumber(avgDelta, 1)}` },
      { label: '平均 OEE 回饋', value: formatNumber(avgOee, 1), delta: `${avgOee >= 0 ? '+' : ''}${formatNumber(avgOee, 1)}` },
    ]
  }, [filteredRewardRows])

  async function applyRewardFilters() {
    const nextFilters = { ...rewardDraftFilters }
    setRewardFilters(nextFilters)
    setLoading(true)
    try {
      const payload = await loadRewardLogDashboard(nextFilters)
      const count = Array.isArray(payload?.logs) ? payload.logs.length : filteredRewardRows.length
      setMessage(`Reward 查詢條件已套用：目前符合 ${count} 筆。`)
    } catch (err) {
      setMessage(err?.response?.data?.detail || err?.message || 'Reward 查詢失敗')
    } finally {
      setLoading(false)
    }
  }

  async function resetRewardFilters() {
    const defaults = { timeRange: '24h', runId: 'ALL', scope: 'ALL', actionType: 'ALL' }
    setRewardDraftFilters(defaults)
    setRewardFilters(defaults)
    setLoading(true)
    try {
      const payload = await loadRewardLogDashboard(defaults)
      const count = Array.isArray(payload?.logs) ? payload.logs.length : 0
      setMessage(`Reward 查詢條件已重置：目前顯示 ${count} 筆。`)
    } catch (err) {
      setMessage(err?.response?.data?.detail || err?.message || 'Reward 查詢重置失敗')
    } finally {
      setLoading(false)
    }
  }

  function renderOverviewTab() {
    return (
      <div className="war-content-stack">
        {sectionTitle('', '')}
        <div className="war-overview-grid">
          <div className="war-panel">
            <h3>今日核心 KPI</h3>
            <div className="war-card-grid war-card-grid-2">
              <KpiTile label="機台稼動率" value={formatPercent(kpi.realtime_utilization_rate || 0, 1)} sub="全機台平均" tone="good" />
              <KpiTile label="今日 OEE" value={formatPercent(kpi.today_oee || 0, 1)} sub="即時整體 OEE" tone="good" />
              <KpiTile label="延遲風險工單" value={`${kpi.delayed_work_orders || 0} 張`} sub="需優先重排" tone="warn" />
              <KpiTile label="缺貨風險工單" value={`${kpi.shortage_risk_orders || 0} 張`} sub="線邊庫 / 交期聯動" tone="bad" />
            </div>
          </div>

          <div className="war-panel">
            <h3>機台狀態分布</h3>
            <StatusDistribution kpi={kpi} />
          </div>

          <div className="war-panel">
            <h3>機台負載熱力圖</h3>
            <Heatmap rows={filteredHeatmap} />
          </div>

          <div className="war-panel">
            <h3>即時 Reward 快照</h3>
            <div className="war-card-grid war-card-grid-2">
              <KpiTile label="目前 Reward" value={`${formatNumber(rewardStats.current, 1)} / 100`} sub="最新一筆" tone="good" />
              <KpiTile label="平均 Reward" value={`${formatNumber(rewardStats.avgScore, 1)} / 100`} sub="近期平均" tone="good" />
              <KpiTile label="最高分" value={`${formatNumber(rewardStats.maxScore, 1)} / 100`} sub="近 24 小時" tone="good" />
              <KpiTile label="最低分" value={`${formatNumber(rewardStats.minScore, 1)} / 100`} sub="近 24 小時" tone="warn" />
            </div>
          </div>
        </div>

        <div className="war-bottom-grid war-bottom-grid-3">
          <section className="war-panel">
            <h3>AI 排程建議</h3>
            <SimpleTable
              columns={['work_order_no', 'to_cnc', 'expected_effect', 'confidence_score']}
              labels={{ work_order_no: '工單', to_cnc: '建議機台', expected_effect: '預期效果', confidence_score: '信心' }}
              rows={data.ai_suggestions || []}
              max={6}
            />
          </section>
          <section className="war-panel">
            <h3>即時異常預警</h3>
            <SimpleTable
              columns={['cnc_machine_id', 'alert_level', 'alert_reason', 'status']}
              labels={{ cnc_machine_id: '機台', alert_level: '等級', alert_reason: '異常說明', status: '狀態' }}
              rows={filteredAlerts}
              max={6}
            />
          </section>
          <section className="war-panel">
            <h3>線邊庫 / 缺料風險</h3>
            <SimpleTable
              columns={['cnc_machine_id', 'material_no', 'available_qty', 'safety_stock_qty', 'shortage_qty', 'ai_judgement']}
              labels={{ cnc_machine_id: '機台', material_no: '物料', available_qty: '可用庫存', safety_stock_qty: '安全庫存', shortage_qty: '缺料量', ai_judgement: 'AI 判斷' }}
              rows={filteredLineStock}
              max={6}
            />
          </section>
        </div>
      </div>
    )
  }

  function renderAiBoardTab() {
    return (
      <div className="war-content-stack war-ai-board-compact aips-111-dashboard aips-112-dashboard">
        <div className="war-main-grid war-main-grid-original aips-resizable-layout" style={aiBoardGridStyle}>
          <aside className="war-panel war-left war-left-designed">
            <OverviewStatusPanel kpi={kpi} nowText={nowText} />
            <CompactRealtimeKpi kpi={kpi} />
            <ProductionProgressPanel progress={productionProgress} kpi={kpi} />
            <CompactLearningPanel rewardStats={rewardStats} data={data} />
          </aside>

          <div
            className="aips-dashboard-resizer aips-dashboard-resizer-left"
            role="separator"
            aria-orientation="vertical"
            aria-label="拖曳調整左側總覽寬度"
            title="拖曳調整左側總覽寬度"
            onPointerDown={(event) => startAiBoardColumnDrag('left', event)}
            onDoubleClick={resetAiBoardColumns}
          />

          <main className="war-panel war-center">
            <div className="war-panel-title-row">
              <div>
                <h3>14 台 CNC 即時排程甘特圖 <span>(AI 智慧排程)</span></h3>
                <p>14 台 CNC 的週 / 日 / 月排程、即時進度與 AI 預測排程。</p>
              </div>
              <div className="war-mini-switch" role="group" aria-label="切換排程視圖">
                <button type="button" className={viewMode === 'day' ? 'active' : ''} onClick={() => setViewMode('day')}>日</button>
                <button type="button" className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>週</button>
                <button type="button" className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>月</button>
              </div>
            </div>
            <div className="war-legend">
              <span><i className="running" />加工中</span>
              <span><i className="idle" />待機中</span>
              <span><i className="done" />已完成</span>
              <span><i className="alarm" />異常</span>
              <span><i className="maintain" />保養中</span>
              <span><i className="predicted" />AI 預測排程</span>
            </div>
            <WarGantt rows={filteredGantt} cards={filteredCards} viewMode={viewMode} />
          </main>

          <div
            className="aips-dashboard-resizer aips-dashboard-resizer-right"
            role="separator"
            aria-orientation="vertical"
            aria-label="拖曳調整右側資訊欄寬度"
            title="拖曳調整右側資訊欄寬度"
            onPointerDown={(event) => startAiBoardColumnDrag('right', event)}
            onDoubleClick={resetAiBoardColumns}
          />

          <aside className="war-panel war-right">
            <h3>機台狀態分布 <span>{kpi.cnc_total || 14} 台</span></h3>
            <StatusDistribution kpi={kpi} />

            <h3>機台負載熱力圖 (%)</h3>
            <Heatmap rows={filteredHeatmap} />

            <h3>AI 排程建議 (DQN)</h3>
            <SimpleTable
              columns={['work_order_no', 'to_cnc', 'expected_effect', 'confidence_score']}
              labels={{ work_order_no: '工單', to_cnc: '建議機台', expected_effect: '預期效果', confidence_score: '信心' }}
              rows={data.ai_suggestions || []}
              max={5}
            />

          </aside>
        </div>

        <AIBoardBottomBlock
          data={data}
          kpi={kpi}
          rewardStats={rewardStats}
          workOrders={workOrders}
          lineStockRows={filteredLineStock}
          toolRows={toolRows}
          alerts={filteredAlerts}
          onReschedule={aiReschedule}
          onSimulate={simulateReschedulePreview}
          loading={loading}
        />
      </div>
    )
  }

  function renderRewardTab() {
    const stats = filteredRewardStats
    return (
      <div className="war-content-stack">
        {sectionTitle('', 'Reward Log 以 DQN 排程決策事件為核心，Key = schedule_run_id + decision_step_no + reward_scope + work_order_no + operation_seq + machine_id + action_code。')}

        <div className="war-reward-layout">
          <aside className="war-reward-sidebar">
            <section className="war-panel war-reward-summary-panel">
              <h3>即時 DQN Reward 總覽</h3>
              <div className="war-reward-summary-stack">
                <KpiTile label="目前總 Reward 分數" value={`${formatNumber(stats.current, 1)} / 100`} sub="較前次變化依篩選結果計算" tone="good" />
                <KpiTile label="平均 Reward（最近 24 小時）" value={`${formatNumber(stats.avgScore, 1)} / 100`} sub="依目前條件篩選" tone="good" />
                <KpiTile label="最高 Reward（最近 24 小時）" value={`${formatNumber(stats.maxScore, 1)} / 100`} sub="近期最佳結果" tone="good" />
                <KpiTile label="最低 Reward（最近 24 小時）" value={`${formatNumber(stats.minScore, 1)} / 100`} sub="需要持續改善" tone="warn" />
                <KpiTile label="已執行 Action 總數" value={`${stats.actionCount} 筆`} sub={`自動 ${stats.autoActionCount} / 人工 ${stats.manualActionCount}`} tone="good" />
              </div>
            </section>

            <section className="war-panel war-reward-improvement-panel">
              <h3>改善效果（24H）</h3>
              <div className="war-reward-improvement-list">
                {rewardImprovementRows.map((item) => (
                  <div key={item.label} className="war-reward-improvement-item">
                    <span>{item.label}</span>
                    <b>{item.value}</b>
                    <em className={String(item.delta).startsWith('-') ? 'neg' : 'pos'}>{item.delta}</em>
                  </div>
                ))}
              </div>
            </section>

            <section className="war-panel war-reward-filter-panel">
              <h3>查詢條件</h3>
              <div className="war-filter-form">
                <label>
                  <span>時間範圍</span>
                  <select value={rewardDraftFilters.timeRange} onChange={(e) => setRewardDraftFilters((prev) => ({ ...prev, timeRange: e.target.value }))}>
                    <option value="6h">最近 6 小時</option>
                    <option value="12h">最近 12 小時</option>
                    <option value="24h">最近 24 小時</option>
                    <option value="7d">最近 7 天</option>
                    <option value="ALL">全部</option>
                  </select>
                </label>
                <label>
                  <span>排程批次 (Run ID)</span>
                  <select value={rewardDraftFilters.runId} onChange={(e) => setRewardDraftFilters((prev) => ({ ...prev, runId: e.target.value }))}>
                    <option value="ALL">全部</option>
                    {rewardRunOptions.map((item, index) => <option key={`run-${item}-${index}`} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  <span>Reward Scope</span>
                  <select value={rewardDraftFilters.scope} onChange={(e) => setRewardDraftFilters((prev) => ({ ...prev, scope: e.target.value }))}>
                    <option value="ALL">全部</option>
                    <option value="WORK_ORDER">工單</option>
                    <option value="MACHINE">機台</option>
                    <option value="OPERATION">工序</option>
                    <option value="SCHEDULE_GLOBAL">整體排程</option>
                    <option value="MATERIAL">物料</option>
                    <option value="TOOLING">刀具</option>
                    <option value="QUALITY">品質</option>
                    <option value="MAINTENANCE">維護</option>
                  </select>
                </label>
                <label>
                  <span>Action 類型</span>
                  <select value={rewardDraftFilters.actionType} onChange={(e) => setRewardDraftFilters((prev) => ({ ...prev, actionType: e.target.value }))}>
                    <option value="ALL">全部</option>
                    {rewardActionTypeOptions.map((item, index) => <option key={`action-type-${item}-${index}`} value={item}>{item}</option>)}
                  </select>
                </label>
                <div className="war-filter-actions">
                  <button type="button" className="primary-btn" onClick={applyRewardFilters}>查詢</button>
                  <button type="button" onClick={resetRewardFilters}>重置</button>
                </div>
              </div>
            </section>
          </aside>

          <div className="war-reward-main-content">
            <div className="war-reward-main-grid">
              <div className="war-panel war-reward-chart-panel">
                <RewardTrendChart rows={filteredRewardRows} events={filteredRewardTimelineRows} />
              </div>
              <div className="war-side-stack">
                <RewardDistribution stats={stats} />
                <RewardComposition stats={stats} />
              </div>
            </div>

            <div className="war-panel">
              <h3>Reward 事件時間軸（對應 Action）</h3>
              <RewardTimeline rows={filteredRewardTimelineRows} />
            </div>

            <div className="war-panel">
              <h3>DQN Reward Log 明細（即時）</h3>
              <SimpleTable
                columns={['reward_time', 'schedule_run_id', 'decision_step_no', 'reward_scope', 'work_order_no', 'cnc_machine_id', 'action_name', 'reward_after', 'delta', 'q_value', 'confidence_pct']}
                labels={{ reward_time: '時間', schedule_run_id: 'Run ID', decision_step_no: 'Step', reward_scope: 'Scope', work_order_no: '工單', cnc_machine_id: '機台', action_name: 'Action', reward_after: 'Reward 總分', delta: '改善值', q_value: 'Q-Value', confidence_pct: 'Confidence' }}
                rows={filteredRewardRows.map((row) => ({ ...row, reward_scope: scopeText(row.reward_scope), delta: `${Number(row.delta) >= 0 ? '+' : ''}${formatNumber(row.delta, 1)}` }))}
                max={0}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderWorkOrdersTab() {
    const highPriority = uniqueWorkOrders.filter((row) => Number(row.priority_level || 0) >= 8).length
    const delayedOrders = uniqueWorkOrders.filter((row) => row.delay_risk_flag === true || row.delay_risk_flag === 'true').length
    return (
      <div className="war-content-stack">
        {sectionTitle('', '查看工單數量、優先權、交期與對應機台，支援排程追蹤。')}
        <div className="war-card-grid war-card-grid-4">
          <KpiTile label="工單總數" value={`${uniqueWorkOrders.length} 張`} sub="今日可見工單" tone="good" />
          <KpiTile label="高優先工單" value={`${highPriority} 張`} sub="priority >= 8" tone="warn" />
          <KpiTile label="延遲風險" value={`${delayedOrders} 張`} sub="需重排或插單" tone="bad" />
          <KpiTile label="選取 CNC" value={selectedCnc === 'ALL' ? '全部機台' : selectedCnc} sub="可搭配上方篩選" />
        </div>
        <div className="war-bottom-grid war-bottom-grid-2">
          <section className="war-panel">
            <h3>工單清單</h3>
            <SimpleTable
              columns={['work_order_no', 'product_no', 'planned_qty', 'remaining_qty', 'priority_level', 'assigned_cnc_machine_id', 'due_date', 'delay_risk_flag']}
              labels={{ work_order_no: '工單', product_no: '產品', planned_qty: '計畫量', remaining_qty: '剩餘量', priority_level: '優先權', assigned_cnc_machine_id: '機台', due_date: '交期', delay_risk_flag: '延遲風險' }}
              rows={uniqueWorkOrders}
              max={0}
            />
          </section>
          <section className="war-panel">
            <h3>AI 建議對應工單</h3>
            <SimpleTable
              columns={['work_order_no', 'from_cnc', 'to_cnc', 'expected_effect', 'reason']}
              labels={{ work_order_no: '工單', from_cnc: '原機台', to_cnc: '建議機台', expected_effect: '預期效果', reason: '原因' }}
              rows={data.ai_suggestions || []}
              max={10}
            />
          </section>
        </div>
      </div>
    )
  }

  function renderMachinesTab() {
    return (
      <div className="war-content-stack">
        {sectionTitle('', '查看每台 CNC 即時狀態、目前工單、負載、電表特徵與風險。')}
        <div className="war-machine-grid">
          {filteredCards.map((card, index) => (
            <div key={stableKey("machine-card", card, index)} className="war-panel war-machine-card">
              <div className="war-machine-head">
                <div>
                  <h3>{card.cnc_machine_id}</h3>
                  <p>{statusText(card.status)}</p>
                </div>
                <span className={`war-status-badge ${statusClass(card.status)}`}>{statusText(card.status)}</span>
              </div>
              <div className="war-machine-meta">
                <span>目前工單：<b>{card.current_work_order_no || '-'}</b></span>
                <span>產品：<b>{card.current_product_no || '-'}</b></span>
                <span>步驟：<b>{card.current_step_name || '-'}</b></span>
                <span>排程筆數：<b>{card.job_count || 0}</b></span>
              </div>
              <div className="war-progress-stack">
                <ProgressBar label="稼動率" value={card.utilization_rate || 0} colorClass={Number(card.utilization_rate || 0) >= 85 ? 'warn' : 'good'} />
                <ProgressBar label="OEE" value={(Number(card.oee || 0) * 100)} colorClass="cool" />
                <ProgressBar label="刀具剩餘壽命" value={Number(card.tool_life_remaining_rate || 0) * 100} colorClass="violet" />
                <ProgressBar label="異常機率" value={Number(card.abnormal_probability || 0) * 100} colorClass={Number(card.abnormal_probability || 0) * 100 >= 70 ? 'bad' : 'warn'} />
              </div>
              <div className="war-machine-footer">
                <span>功率：{formatNumber(card.power_kw || 0, 2)} kW</span>
                <span>THD：{formatNumber(card.thd || 0, 2)}</span>
                <span>AI 判斷：{card.ai_judgement}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="war-panel">
          <h3>機台異常與風險清單</h3>
          <SimpleTable
            columns={['cnc_machine_id', 'alert_level', 'alert_reason', 'status']}
            labels={{ cnc_machine_id: '機台', alert_level: '等級', alert_reason: '說明', status: '狀態' }}
            rows={filteredAlerts}
            max={0}
          />
        </div>
      </div>
    )
  }

  function renderMaterialsTab() {
    const shortageCount = filteredLineStock.filter((row) => Number(row.shortage_qty || 0) > 0).length
    const riskyOrders = (data.risk_rows || []).filter((row) => String(row.risk_level || '').includes('高') || String(row.risk_level || '').includes('中'))
    return (
      <div className="war-content-stack">
        {sectionTitle('', '結合線邊庫、安全庫存與缺料風險，避免排程看起來可行但現場缺料停線。')}
        <div className="war-card-grid war-card-grid-4">
          <KpiTile label="線邊庫筆數" value={`${filteredLineStock.length} 筆`} sub="Dashboard 摘要資料" tone="good" />
          <KpiTile label="缺料品項" value={`${shortageCount} 筆`} sub="需優先補料" tone="bad" />
          <KpiTile label="高 / 中風險工單" value={`${riskyOrders.length} 張`} sub="交期 / 缺貨聯動" tone="warn" />
          <KpiTile label="一般庫存快照" value={`${inventoryRows.length} 筆`} sub="資料庫 inventory_snapshot" />
        </div>
        <div className="war-bottom-grid war-bottom-grid-2">
          <section className="war-panel">
            <h3>線邊庫即時狀態</h3>
            <SimpleTable
              columns={['cnc_machine_id', 'material_no', 'available_qty', 'safety_stock_qty', 'shortage_qty', 'ai_judgement']}
              labels={{ cnc_machine_id: '機台', material_no: '物料', available_qty: '可用庫存', safety_stock_qty: '安全庫存', shortage_qty: '缺料量', ai_judgement: 'AI 判斷' }}
              rows={filteredLineStock}
              max={0}
            />
          </section>
          <section className="war-panel">
            <h3>缺料風險清單</h3>
            <SimpleTable
              columns={['work_order_no', 'product_no', 'cnc_machine_id', 'risk_level', 'risk_score', 'suggested_action']}
              labels={{ work_order_no: '工單', product_no: '產品', cnc_machine_id: '機台', risk_level: '風險等級', risk_score: '風險分數', suggested_action: '建議動作' }}
              rows={data.risk_rows || []}
              max={0}
            />
          </section>
        </div>
      </div>
    )
  }

  function renderToolsTab() {
    const highRisk = toolRows.filter((row) => row.risk_level === '高').length
    return (
      <div className="war-content-stack">
        {sectionTitle('', '依刀具剩餘壽命、負載與異常風險，調整派工與保養節奏。')}
        <div className="war-card-grid war-card-grid-4">
          <KpiTile label="刀具監控數" value={`${toolRows.length} 支`} sub="每台機台對應主要刀具" tone="good" />
          <KpiTile label="高風險刀具" value={`${highRisk} 支`} sub="建議立即檢查 / 更換" tone="bad" />
          <KpiTile label="平均剩餘壽命" value={`${formatNumber(toolRows.reduce((acc, row) => acc + Number(String(row.remaining_life_rate).replace('%', '') || 0), 0) / Math.max(toolRows.length, 1), 1)}%`} sub="跨機台平均" tone="warn" />
          <KpiTile label="建議保養機台" value={`${filteredCards.filter((card) => Number(card.abnormal_probability || 0) >= 0.45).length} 台`} sub="根據 AI 判斷" tone="warn" />
        </div>
        <div className="war-panel">
          <h3>刀具 / 壽命 / 風險清單</h3>
          <SimpleTable
            columns={['cnc_machine_id', 'tool_no', 'remaining_life_rate', 'risk_level', 'suggested_action', 'current_work_order_no']}
            labels={{ cnc_machine_id: '機台', tool_no: '刀具', remaining_life_rate: '剩餘壽命', risk_level: '風險', suggested_action: '建議動作', current_work_order_no: '目前工單' }}
            rows={toolRows}
            max={0}
          />
        </div>
      </div>
    )
  }

  function renderReportsTab() {
    return (
      <div className="war-content-stack">
        {sectionTitle('', '整理 AI 重排效益、Reward 趨勢與重要 KPI，作為決策與簡報依據。')}
        <div className="war-card-grid war-card-grid-4">
          <KpiTile label="平均 Reward" value={`${formatNumber(rewardStats.avgScore, 1)} / 100`} sub="排程品質總分" tone="good" />
          <KpiTile label="平均稼動率" value={formatPercent(kpi.realtime_utilization_rate || 0, 1)} sub="Dashboard KPI" tone="good" />
          <KpiTile label="AI 建議數" value={`${(data.ai_suggestions || []).length} 筆`} sub="最新排程建議" tone="warn" />
          <KpiTile label="預估改善" value={`${comparisonRows.length ? comparisonRows[0].improvement : '-'} `} sub="延遲工單變化" tone="good" />
        </div>
        <div className="war-bottom-grid war-bottom-grid-2">
          <section className="war-panel">
            <h3>AI 重排成效比較</h3>
            <SimpleTable
              columns={['metric', 'original', 'dqn', 'improvement']}
              labels={{ metric: '指標', original: '原排程', dqn: 'AI 重排後', improvement: '改善' }}
              rows={comparisonRows}
              max={0}
            />
          </section>
          <section className="war-panel">
            <h3>最新 Reward / Action 結果</h3>
            <SimpleTable
              columns={['reward_time', 'work_order_no', 'cnc_machine_id', 'reward_score', 'action_name', 'confidence_pct']}
              labels={{ reward_time: '時間', work_order_no: '工單', cnc_machine_id: '機台', reward_score: 'Reward', action_name: 'Action', confidence_pct: '信心' }}
              rows={rewardRows}
              max={10}
            />
          </section>
        </div>
      </div>
    )
  }

  function renderMaintenanceTab() {
    return (
      <div className="war-content-stack">
        {sectionTitle('', '結合電表 THD、三相不平衡、負載與刀具壽命，提前識別異常機台。')}
        <div className="war-card-grid war-card-grid-4">
          <KpiTile label="高風險機台" value={`${filteredCards.filter((card) => Number(card.abnormal_probability || 0) >= 0.75).length} 台`} sub="應立即檢查" tone="bad" />
          <KpiTile label="中風險機台" value={`${filteredCards.filter((card) => Number(card.abnormal_probability || 0) >= 0.45 && Number(card.abnormal_probability || 0) < 0.75).length} 台`} sub="建議保養" tone="warn" />
          <KpiTile label="異常預警數" value={`${filteredAlerts.length} 筆`} sub="即時事件" tone="warn" />
          <KpiTile label="平均 THD" value={formatNumber(filteredCards.reduce((acc, card) => acc + Number(card.thd || 0), 0) / Math.max(filteredCards.length, 1), 2)} sub="電力品質觀察" />
        </div>
        <div className="war-bottom-grid war-bottom-grid-2">
          <section className="war-panel">
            <h3>機台維護風險</h3>
            <SimpleTable
              columns={['cnc_machine_id', 'status', 'thd', 'phase_imbalance_rate', 'abnormal_probability', 'ai_judgement']}
              labels={{ cnc_machine_id: '機台', status: '狀態', thd: 'THD', phase_imbalance_rate: '三相不平衡', abnormal_probability: '異常機率', ai_judgement: 'AI 建議' }}
              rows={filteredCards.map((card) => ({ ...card, abnormal_probability: formatPercent(Number(card.abnormal_probability || 0) * 100, 1), status: statusText(card.status) }))}
              max={0}
            />
          </section>
          <section className="war-panel">
            <h3>維護 / 刀具建議</h3>
            <SimpleTable
              columns={['cnc_machine_id', 'tool_no', 'remaining_life_rate', 'risk_level', 'suggested_action']}
              labels={{ cnc_machine_id: '機台', tool_no: '刀具', remaining_life_rate: '剩餘壽命', risk_level: '風險', suggested_action: '建議動作' }}
              rows={toolRows}
              max={0}
            />
          </section>
        </div>
      </div>
    )
  }

  function renderSettingsTab() {
    return (
      <div className="war-content-stack">
        {sectionTitle('', '顯示目前系統版本、資料來源、關鍵模組與儀表板設定。')}
        <div className="war-bottom-grid war-bottom-grid-2">
          <section className="war-panel">
            <h3>系統基本資訊</h3>
            <div className="war-settings-list">
              <div><span>系統名稱</span><b>AIPS 智慧排程系統</b></div>
              <div><span>目前登入者</span><b>admin</b></div>
              <div><span>Dashboard 版本</span><b>FIX90_DASHBOARD_DARK_TABS</b></div>
              <div><span>資料日期</span><b>{scheduleDate}</b></div>
              <div><span>資料來源</span><b>CNC / ERP / WMS / DQN / Reward</b></div>
            </div>
          </section>
          <section className="war-panel">
            <h3>畫面與操作設定</h3>
            <div className="war-settings-list">
              <div><span>主色風格</span><b>深色戰情室高對比</b></div>
              <div><span>甘特圖時間軸</span><b>08:00 ~ 20:00</b></div>
              <div><span>內頁 Tab 順序</span><b>依 Word 規格重排</b></div>
              <div><span>Reward 頁面</span><b>已整合到 Dashboard Tab</b></div>
              <div><span>重新整理</span><b>可手動更新 / AI 一鍵重排</b></div>
            </div>
            <div className="war-settings-actions">
              <button onClick={() => load(scheduleDate)} disabled={loading}>重新整理資料</button>
              <button className="war-primary-btn" onClick={aiReschedule} disabled={loading}>AI 一鍵重排</button>
            </div>
          </section>
        </div>
      </div>
    )
  }

  function renderContent() {
    switch (activeTab) {
      case 'overview': return renderOverviewTab()
      case 'ai_board': return renderAiBoardTab()
      case 'reward': return renderRewardTab()
      case 'work_orders': return renderWorkOrdersTab()
      case 'machines': return renderMachinesTab()
      case 'materials': return renderMaterialsTab()
      case 'tools': return renderToolsTab()
      case 'reports': return renderReportsTab()
      case 'maintenance': return renderMaintenanceTab()
      case 'settings': return renderSettingsTab()
      default: return renderAiBoardTab()
    }
  }

  return (
    <div className="aips-war-dashboard">
      <div className="war-topbar">
        <div className="war-logo">
          <div className="war-logo-mark">A</div>
          <div>
            <h1>AIPS 智慧排程系統</h1>
            <p>AI Intelligent Planning & Scheduling</p>
          </div>
        </div>
        <div className="war-tabs">
          {DASHBOARD_TABS.map((tab) => (
            <button key={tab.key} type="button" className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="war-clock">
          <span>{nowText}</span>
          <b>系統連線正常</b>
          <em>admin</em>
        </div>
      </div>

      <div className="war-toolbar">
        <div>
          <h2>{DASHBOARD_TABS.find((item) => item.key === activeTab)?.label || 'AI 排程看板'} <span>{activeTab === 'reward' ? '(DQN Reward / Log)' : ''}</span></h2>
        </div>
        <div className="war-actions">
          <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
          <select value={selectedCnc} onChange={(e) => setSelectedCnc(e.target.value)}>
            {cncOptions.map((cnc, index) => <option key={`${cnc}-${index}`} value={cnc}>{cnc === 'ALL' ? '全部 CNC' : cnc}</option>)}
          </select>
          <button onClick={() => load(scheduleDate)} disabled={loading}>重新整理</button>
          <button className="war-primary-btn" onClick={aiReschedule} disabled={loading}>AI 一鍵重排</button>
        </div>
      </div>

      {message && <div className="war-message">{message}</div>}
      {renderContent()}
    </div>
  )
}
