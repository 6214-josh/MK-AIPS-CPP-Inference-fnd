import React, { useEffect, useMemo, useState } from 'react'
import apiClient from '../api/apiClient'
import DataTable from './DataTable.jsx'
import { PageHeader } from './SimplePanels.jsx'

function todayText() {
  return new Date().toISOString().slice(0, 10)
}

function fmt(value) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function CncStat({ row }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{row.cnc_machine_id}</div>
      <div className="metric-value">{row.scheduled_hours} / 8h</div>
      <div className="metric-hint">
        工件 {row.job_count} 筆，稼動率 {row.utilization_rate}%，閒置 {row.idle_hours}h
      </div>
    </div>
  )
}

function GanttByCnc({ rows }) {
  const grouped = useMemo(() => {
    const map = {}
    rows.forEach((row) => {
      if (!map[row.cnc_machine_id]) map[row.cnc_machine_id] = []
      map[row.cnc_machine_id].push(row)
    })
    return map
  }, [rows])

  return (
    <div className="cnc-gantt">
      {Object.entries(grouped).map(([cnc, items]) => (
        <div className="cnc-gantt-row" key={cnc}>
          <div className="cnc-gantt-label">{cnc}</div>
          <div className="cnc-gantt-track">
            {items.map((item) => (
              <div
                key={item.schedule_id}
                className={`cnc-gantt-bar ${item.schedule_status === 'SCHEDULED' ? '' : 'over-capacity'}`}
                style={{
                  left: `${item.left_percent}%`,
                  width: `${Math.max(Number(item.width_percent || 0), 4)}%`,
                }}
                title={`${item.work_order_no} / ${item.product_no} / Step ${item.step_no} / ${item.start_time_text} - ${item.end_time_text}`}
              >
                <span>{item.product_no}</span>
                <small>S{item.step_no}</small>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CncDailySchedulePanel() {
  const [scheduleDate, setScheduleDate] = useState(todayText())
  const [summary, setSummary] = useState([])
  const [rows, setRows] = useState([])
  const [ganttRows, setGanttRows] = useState([])
  const [assumptions, setAssumptions] = useState([])
  const [message, setMessage] = useState('')
  const [running, setRunning] = useState(false)

  async function load(targetDate = scheduleDate) {
    const res = await apiClient.get(`/aips/cnc-daily-schedule/result?schedule_date=${targetDate}`)
    setSummary(res.data.summary_by_cnc || [])
    setRows(res.data.schedule_rows || [])
    setGanttRows(res.data.gantt_rows || [])
    setAssumptions(res.data.assumptions || [])
  }

  async function run() {
    setRunning(true)
    setMessage('')
    try {
      const res = await apiClient.post(`/aips/cnc-daily-schedule/run?schedule_date=${scheduleDate}&reset=true&order_limit=30`)
      setMessage(res.data.message || 'CNC 日排程已完成')
      await load(scheduleDate)
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'CNC 日排程產生失敗'
      setMessage(detail)
      alert(detail)
    } finally {
      setRunning(false)
    }
  }

  async function seedAssumptions() {
    setRunning(true)
    setMessage('')
    try {
      const res = await apiClient.post('/aips/cnc-daily-schedule/assumptions/seed?reset=true')
      setMessage(res.data.message || '產品加工順序假設資料已建立')
      await load(scheduleDate)
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || '建立假設資料失敗'
      setMessage(detail)
      alert(detail)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    load(scheduleDate).catch((err) => setMessage(err?.response?.data?.detail || err.message))
  }, [])

  const scheduleColumns = [
    'cnc_machine_id',
    'sequence_no_on_cnc',
    'work_order_no',
    'product_no',
    'step_no',
    'step_name',
    'planned_qty',
    'processing_minutes',
    'setup_minutes',
    'total_minutes',
    'start_time_text',
    'end_time_text',
    'schedule_status',
  ]

  const scheduleLabels = {
    cnc_machine_id: 'CNC',
    sequence_no_on_cnc: '機台順序',
    work_order_no: '製令單',
    product_no: '成品代號',
    step_no: '產品步驟',
    step_name: '加工步驟',
    planned_qty: '數量',
    processing_minutes: '加工分鐘',
    setup_minutes: '換線/準備',
    total_minutes: '合計分鐘',
    start_time_text: '開始',
    end_time_text: '結束',
    schedule_status: '狀態',
  }

  const assumptionColumns = [
    'product_no',
    'product_name',
    'step_no',
    'step_name',
    'cnc_machine_id',
    'processing_minutes',
    'setup_minutes',
    'sequence_note',
  ]

  const assumptionLabels = {
    product_no: '成品代號',
    product_name: '產品名稱',
    step_no: '步驟',
    step_name: '加工內容',
    cnc_machine_id: 'CNC',
    processing_minutes: '加工分鐘',
    setup_minutes: '準備分鐘',
    sequence_note: '順序說明',
  }

  return (
    <div className="page">
      <PageHeader
        title="CNC 每日排程統計"
        subtitle="模擬一天 8 小時排程，根據 CNC-01 / CNC-02 / CNC-03 分機台排列，並檢查每個成品最多三個 CNC 加工步驟。"
      >
        <input
          type="date"
          value={scheduleDate}
          onChange={(e) => setScheduleDate(e.target.value)}
        />
        <button onClick={() => load(scheduleDate)} disabled={running}>重新整理</button>
        <button onClick={seedAssumptions} disabled={running}>重建產品加工順序假設</button>
        <button className="primary-btn" onClick={run} disabled={running}>
          {running ? '計算中...' : '產生 8 小時日排程'}
        </button>
      </PageHeader>

      {message && <div className="export-message">操作結果：{message}</div>}

      <div className="metric-grid">
        {summary.map((row) => <CncStat key={row.cnc_machine_id} row={row} />)}
      </div>

      <div className="card">
        <h2>每台 CNC 8 小時排程甘特圖</h2>
        <p className="section-note">
          橫軸代表 08:00 ~ 16:00，依 CNC 代號分列。紅色代表超過 8 小時產能但仍保留供檢查。
        </p>
        <GanttByCnc rows={ganttRows.length ? ganttRows : rows} />
      </div>

      <div className="card">
        <h2>依 CNC 代號排列的每日排程結果</h2>
        <DataTable
          columns={scheduleColumns}
          labels={scheduleLabels}
          rows={rows}
          defaultPageSize={20}
        />
      </div>

      <div className="card">
        <h2>每個產品在每台 CNC 的加工順序與時間假設</h2>
        <p className="section-note">
          原則：每個成品代號最多 3 個步驟；每個步驟指定 CNC 代號與加工時間，日排程會依步驟順序與機台可用時間排入。
        </p>
        <DataTable
          columns={assumptionColumns}
          labels={assumptionLabels}
          rows={assumptions}
          defaultPageSize={20}
        />
      </div>
    </div>
  )
}
