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

function WarGantt({ rows, cards }) {
  const cncCodes = Array.from({ length: 14 }, (_, index) => `CNC-${pad2(index + 1)}`)
  const grouped = useMemo(() => {
    const map = {}
    ;(rows || []).forEach((row) => {
      if (!map[row.cnc_machine_id]) map[row.cnc_machine_id] = []
      map[row.cnc_machine_id].push(row)
    })
    return map
  }, [rows])
  const cardMap = useMemo(() => Object.fromEntries((cards || []).map((c) => [c.cnc_machine_id, c])), [cards])

  return (
    <div className="war-gantt">
      <div className="war-gantt-header">
        <span>機台</span>
        <span>狀態</span>
        <span>08:00</span>
        <span>10:00</span>
        <span>12:00</span>
        <span>14:00</span>
        <span>16:00</span>
        <span>18:00</span>
        <span>20:00</span>
        <span>進度</span>
      </div>

      {cncCodes.map((cnc) => {
        const items = grouped[cnc] || []
        const card = cardMap[cnc] || {}
        return (
          <div className="war-gantt-row" key={cnc}>
            <div className="war-gantt-machine">{cnc}</div>
            <div className="war-gantt-state">
              <StatusDot status={card.status} />
              <b>{formatPercent(card.utilization_rate || 0, 0)}</b>
            </div>
            <div className="war-gantt-track">
              <div className="war-now-line" />
              {items.map((item, index) => (
                <div
                  key={item.schedule_id || `${cnc}-${index}`}
                  className={`war-gantt-bar ${item.schedule_status === 'OVER_CAPACITY' ? 'danger' : ''} ${item.is_ai_prediction ? 'predicted' : ''}`}
                  style={{
                    left: `${Math.max(0, Math.min(Number(item.left_percent || 0), 99))}%`,
                    width: `${Math.max(Number(item.width_percent || 0), 4)}%`,
                  }}
                  title={`${item.work_order_no || '-'} / ${item.product_no || '-'} / ${item.start_time_text || ''} - ${item.end_time_text || ''}`}
                >
                  {item.work_order_no || item.product_no || 'JOB'}
                </div>
              ))}
            </div>
            <div className="war-gantt-progress">{card.over_capacity_hours > 0 ? '延遲' : `${card.job_count || 0}筆`}</div>
          </div>
        )
      })}
    </div>
  )
}

function StatusDistribution({ kpi }) {
  const total = Number(kpi.cnc_total || 14)
  const rows = [
    ['加工中', kpi.running_count || 0, 'running'],
    ['待機中', kpi.idle_count || 0, 'idle'],
    ['異常中', kpi.alarm_count || 0, 'alarm'],
    ['保養中', kpi.maintenance_count || 0, 'maintain'],
    ['離線中', kpi.offline_count || 0, 'offline'],
  ]

  return (
    <div className="war-status-distribution">
      <div className="war-donut">
        <div><b>{total}</b><span>總計</span></div>
      </div>
      <div className="war-distribution-list">
        {rows.map(([label, count, tone]) => (
          <div key={label}>
            <span><i className={`war-legend-dot ${tone}`} />{label}</span>
            <b>{count} ({Math.round(Number(count || 0) / Math.max(total, 1) * 100)}%)</b>
          </div>
        ))}
      </div>
    </div>
  )
}

function Heatmap({ rows }) {
  return (
    <div className="war-heatmap">
      {(rows || []).map((row) => {
        const rate = Number(row.utilization_rate || 0)
        const tone = rate >= 90 ? 'hot' : rate >= 70 ? 'warm' : rate <= 45 ? 'cool' : 'ok'
        return (
          <div key={row.cnc_machine_id} className={`war-heatmap-cell ${tone}`}>
            <b>{row.cnc_machine_id}</b>
            <span>{formatPercent(rate, 0)}</span>
            <small>{row.status === 'ALARM' ? '異常' : row.ai_judgement}</small>
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
            <tr key={row.id || row.schedule_id || row.reward_id || row.action_id || row.work_order_no || row.cnc_machine_id || index}>
              {columns.map((c) => <td key={c}>{row[c] ?? '-'}</td>)}
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
          <g key={`event-${event.markerNo}`}>
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
              key={`track-${row.reward_id || row.reward_log_id || index}`}
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
            <div key={row.reward_id || row.reward_log_id || index} className={`war-event-card tone-${row.delta >= 0 ? 'good' : 'bad'}`}>
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
  const [activeTab, setActiveTab] = useState('ai_board')
  const [nowText, setNowText] = useState(formatDateTime())
  const [data, setData] = useState({ cards: [], kpi: {}, gantt_rows: [], ai_suggestions: [], alerts: [], line_stock_rows: [], maintenance_rows: [], heatmap_rows: [] })
  const [rewards, setRewards] = useState([])
  const [rewardLogDashboard, setRewardLogDashboard] = useState({ summary: {}, logs: [], distribution: [], composition: [], timeline: [] })
  const [workOrderRows, setWorkOrderRows] = useState([])
  const [inventoryRows, setInventoryRows] = useState([])
  const [actionRows, setActionRows] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function load(targetDate = scheduleDate) {
    setLoading(true)
    setMessage('')
    const requests = await Promise.allSettled([
      apiClient.get(`/aips/cnc-dashboard/summary?schedule_date=${targetDate}`),
      apiClient.get('/aips/rewards/latest?limit=120'),
      apiClient.get('/aips/reward-log/dashboard?limit=120'),
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
      const res = await apiClient.post(`/aips/cnc-dashboard/ai-reschedule?schedule_date=${scheduleDate}`)
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

  useEffect(() => {
    load(scheduleDate)
    const timer = setInterval(() => setNowText(formatDateTime()), 1000)
    return () => clearInterval(timer)
  }, [])

  const cards = data.cards || []
  const kpi = data.kpi || {}
  const cncOptions = ['ALL', ...cards.map((c) => c.cnc_machine_id).filter(Boolean).sort()]
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

  function renderOverviewTab() {
    return (
      <div className="war-content-stack">
        {sectionTitle('即時總覽', '把 14 台 CNC 狀態、排程風險、物料與 Reward 學習結果整合為管理總覽。')}
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
      <div className="war-content-stack war-ai-board-compact">
        <div className="war-main-grid war-main-grid-original">
          <aside className="war-panel war-left">
            <h3>即時總覽</h3>
            <div className="war-stack">
              <KpiTile label="機台總數" value={`${kpi.cnc_total || 14} 台`} sub="CNC-01 ~ CNC-14" />
              <KpiTile label="加工中" value={`${kpi.running_count || 0} 台`} sub={`${Math.round((kpi.running_count || 0) / Math.max(kpi.cnc_total || 14, 1) * 100)}%`} tone="good" />
              <KpiTile label="待機中" value={`${kpi.idle_count || 0} 台`} sub="等待加工 / 待機" tone="warn" />
              <KpiTile label="異常中" value={`${kpi.alarm_count || 0} 台`} sub="需立即處理" tone="bad" />
              <KpiTile label="離線 / 保養" value={`${(kpi.offline_count || 0) + (kpi.maintenance_count || 0)} 台`} sub="不可派工" />
            </div>

            <h3>即時 KPI</h3>
            <div className="war-ring-row">
              <MiniRing value={Math.round(kpi.today_oee || 0)} label="OEE" />
              <div className="war-kpi-list">
                <span>稼動率 <b>{formatPercent(kpi.realtime_utilization_rate || 0, 1)}</b></span>
                <span>完成工單 <b>{kpi.completed_work_orders || 0} / {kpi.total_work_orders || 0}</b></span>
                <span>延遲風險 <b>{kpi.delayed_work_orders || 0}</b></span>
                <span>缺貨風險 <b>{kpi.shortage_risk_orders || 0}</b></span>
              </div>
            </div>

            <h3>DQN 學習狀態</h3>
            <div className="war-learning">
              <b>平均 Reward 分數</b>
              <strong>{formatNumber(rewardStats.avgScore || 82, 1)} / 100</strong>
              <div className="war-sparkline" />
              <span>學習進度 63%</span>
            </div>
          </aside>

          <main className="war-panel war-center">
            <div className="war-panel-title-row">
              <div>
                <h3>14 台 CNC 即時排程甘特圖 <span>(AI 智慧排程)</span></h3>
                <p>依原始設計圖保留上方主看板；下半部明細請改到各功能 Tab 查看。</p>
              </div>
              <div className="war-mini-switch">
                <span className="active">週</span>
                <span>日</span>
                <span>月</span>
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
            <WarGantt rows={filteredGantt} cards={filteredCards} />
          </main>

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

            <h3>即時異常預警</h3>
            <SimpleTable
              columns={['cnc_machine_id', 'alert_level', 'alert_reason']}
              labels={{ cnc_machine_id: '機台', alert_level: '等級', alert_reason: '說明' }}
              rows={filteredAlerts}
              max={5}
            />
          </aside>
        </div>
      </div>
    )
  }

  function renderRewardTab() {
    return (
      <div className="war-content-stack">
        {sectionTitle('DQN Reward 分析', '依 Word 設計：Reward Log 以 DQN 排程決策事件為核心，Key = schedule_run_id + decision_step_no + reward_scope + work_order_no + operation_seq + machine_id + action_code。')}
        <div className="war-card-grid war-card-grid-5">
          <KpiTile label="目前總 Reward 分數" value={`${formatNumber(rewardStats.current, 1)} / 100`} sub="最新一筆" tone="good" />
          <KpiTile label="平均 Reward（最近 24H）" value={`${formatNumber(rewardStats.avgScore, 1)} / 100`} sub="持續學習成效" tone="good" />
          <KpiTile label="最高 Reward" value={`${formatNumber(rewardStats.maxScore, 1)} / 100`} sub="近期最佳結果" tone="good" />
          <KpiTile label="最低 Reward" value={`${formatNumber(rewardStats.minScore, 1)} / 100`} sub="需持續改善" tone="warn" />
          <KpiTile label="已執行 Action 總數" value={`${rewardStats.actionCount} 筆`} sub={`自動 ${rewardStats.autoActionCount} / 人工 ${rewardStats.manualActionCount}`} tone="good" />
        </div>

        <div className="war-reward-main-grid">
          <div className="war-panel war-reward-chart-panel">
            <RewardTrendChart rows={rewardRows} events={rewardTimelineRows} />
          </div>
          <div className="war-side-stack">
            <RewardDistribution stats={rewardStats} />
            <RewardComposition stats={rewardStats} />
          </div>
        </div>

        <div className="war-panel">
          <h3>Reward 事件時間軸（對應 Action）</h3>
          <RewardTimeline rows={rewardTimelineRows} />
        </div>

        <div className="war-panel">
          <h3>DQN Reward Log 明細（即時）</h3>
          <SimpleTable
            columns={['reward_time', 'schedule_run_id', 'decision_step_no', 'reward_scope', 'work_order_no', 'cnc_machine_id', 'action_name', 'reward_after', 'delta', 'q_value', 'confidence_pct']}
            labels={{ reward_time: '時間', schedule_run_id: 'Run ID', decision_step_no: 'Step', reward_scope: 'Scope', work_order_no: '工單', cnc_machine_id: '機台', action_name: 'Action', reward_after: 'Reward 總分', delta: '改善值', q_value: 'Q-Value', confidence_pct: 'Confidence' }}
            rows={rewardRows.map((row) => ({ ...row, reward_scope: scopeText(row.reward_scope), delta: `${row.delta >= 0 ? '+' : ''}${formatNumber(row.delta, 1)}` }))}
            max={0}
          />
        </div>
      </div>
    )
  }

  function renderWorkOrdersTab() {
    const highPriority = uniqueWorkOrders.filter((row) => Number(row.priority_level || 0) >= 8).length
    const delayedOrders = uniqueWorkOrders.filter((row) => row.delay_risk_flag === true || row.delay_risk_flag === 'true').length
    return (
      <div className="war-content-stack">
        {sectionTitle('工單管理', '查看工單數量、優先權、交期與對應機台，支援排程追蹤。')}
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
        {sectionTitle('機台管理', '查看每台 CNC 即時狀態、目前工單、負載、電表特徵與風險。')}
        <div className="war-machine-grid">
          {filteredCards.map((card) => (
            <div key={card.cnc_machine_id} className="war-panel war-machine-card">
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
        {sectionTitle('物料管理', '結合線邊庫、安全庫存與缺料風險，避免排程看起來可行但現場缺料停線。')}
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
        {sectionTitle('刀具管理', '依刀具剩餘壽命、負載與異常風險，調整派工與保養節奏。')}
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
        {sectionTitle('報表分析', '整理 AI 重排效益、Reward 趨勢與重要 KPI，作為決策與簡報依據。')}
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
        {sectionTitle('預測維護', '結合電表 THD、三相不平衡、負載與刀具壽命，提前識別異常機台。')}
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
        {sectionTitle('系統設定', '顯示目前系統版本、資料來源、關鍵模組與儀表板設定。')}
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
          <h2>{DASHBOARD_TABS.find((item) => item.key === activeTab)?.label || 'AI 排程看板'} <span>{activeTab === 'reward' ? '(DQN Reward / Log)' : '(AIPS 14 台 CNC)'}</span></h2>
          <p>整合 CNC、ERP、WMS、DQN 與 Reward 閉環學習，避免白底低對比造成資訊難以辨識。</p>
        </div>
        <div className="war-actions">
          <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
          <select value={selectedCnc} onChange={(e) => setSelectedCnc(e.target.value)}>
            {cncOptions.map((cnc) => <option key={cnc} value={cnc}>{cnc === 'ALL' ? '全部 CNC' : cnc}</option>)}
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
