import React, { useEffect, useMemo, useState } from 'react'
import apiClient from '../api/apiClient'
import DataTable from './DataTable.jsx'
import { PageHeader } from './SimplePanels.jsx'
import flowImage from '../assets/aips-flow-1-10.jpg'

function toArray(data) {
  return Array.isArray(data) ? data : []
}

function text(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

function formatTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('zh-TW', { hour12: false })
}

function firstRow(rows) {
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

function pickFields(row, keys) {
  if (!row) return []
  return keys
    .filter((key) => row[key] !== undefined && row[key] !== null && row[key] !== '')
    .map((key) => ({ field: key, value: text(row[key]) }))
}

function StatusBadge({ ready }) {
  return (
    <span className={ready ? 'flow-status-badge ready' : 'flow-status-badge pending'}>
      {ready ? '可驗證' : '待補資料'}
    </span>
  )
}

function SmallStat({ title, value, note }) {
  return (
    <div className="flow-small-stat">
      <div className="flow-small-stat-title">{title}</div>
      <div className="flow-small-stat-value">{value}</div>
      <div className="flow-small-stat-note">{note}</div>
    </div>
  )
}

function SectionCard({ no, title, pageName, ready, children }) {
  return (
    <div className="card flow-section-card">
      <div className="flow-section-header">
        <div>
          <h2>{no}. {title}</h2>
          <div className="flow-section-page">對應頁面：{pageName}</div>
        </div>
        <StatusBadge ready={ready} />
      </div>
      <div className="flow-section-body">{children}</div>
    </div>
  )
}

export default function AipsFlowVerificationPanel() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({
    dashboard: {},
    meterRows: [],
    meterFeatures: [],
    workOrders: [],
    inventory: [],
    runCardHeaders: [],
    runCardFeatures: [],
    predictions: [],
    states: [],
    actions: [],
    rewards: [],
    modelStatus: null,
    workflow: null,
  })

  async function load() {
    setLoading(true)
    try {
      const [
        dashboard,
        meterRows,
        meterFeatures,
        workOrders,
        inventory,
        runCardHeaders,
        runCardFeatures,
        predictions,
        states,
        actions,
        rewards,
        modelStatus,
        workflow,
      ] = await Promise.all([
        apiClient.get('/dashboard/summary').then((r) => r.data).catch(() => ({})),
        apiClient.get('/meter/raw/latest').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/meter/features/latest').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/work-orders/snapshots/latest').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/inventory/snapshots/latest').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/run-cards/headers').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/run-cards/features').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/aips/predictions/latest').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/aips/states/latest').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/aips/dqn/actions/latest').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/aips/rewards/latest').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/aips/models/status').then((r) => r.data).catch(() => null),
        apiClient.get('/aips/model-optimization/workflow').then((r) => r.data).catch(() => null),
      ])

      setData({
        dashboard,
        meterRows,
        meterFeatures,
        workOrders,
        inventory,
        runCardHeaders,
        runCardFeatures,
        predictions,
        states,
        actions,
        rewards,
        modelStatus,
        workflow,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const meterLatest = firstRow(data.meterRows)
  const meterFeatureLatest = firstRow(data.meterFeatures)
  const workOrderLatest = firstRow(data.workOrders)
  const inventoryLatest = firstRow(data.inventory)
  const runCardLatest = firstRow(data.runCardHeaders)
  const featureLatest = firstRow(data.runCardFeatures)
  const predictionLatest = firstRow(data.predictions)
  const stateLatest = firstRow(data.states)
  const rewardLatest = firstRow(data.rewards)

  const stateFeatureRows = useMemo(() => pickFields(stateLatest, [
    'remaining_qty',
    'due_pressure',
    'previous_step_ready',
    'current_oee',
    'utilization',
    'energy_kwh',
    'shortage_risk',
    'quality_risk',
    'predicted_processing_time',
    'predicted_output_qty',
    'predicted_yield_rate',
    'priority_level',
    'shortage_risk_score',
    'delay_risk_score',
    'quality_risk_score',
    'power_risk_score',
  ]), [stateLatest])

  const featureEngineeringRows = useMemo(() => {
    const source = featureLatest || meterFeatureLatest || {}
    return pickFields(source, [
      'oee',
      'thd',
      'utilization_rate',
      'shortage_risk',
      'due_pressure',
      'previous_step_ready',
      'estimated_hours',
      'energy_kwh',
      'quality_risk',
      'priority_level',
    ])
  }, [featureLatest, meterFeatureLatest])

  const inputSummaryRows = [
    {
      source: 'ERP 製令資料',
      count: data.workOrders.length,
      latest: formatTime(workOrderLatest?.snapshot_time || workOrderLatest?.created_at || workOrderLatest?.updated_at),
      example: text(workOrderLatest?.work_order_no || workOrderLatest?.order_no),
    },
    {
      source: 'CNC / 智慧電表資料',
      count: data.meterRows.length,
      latest: formatTime(meterLatest?.event_time || meterLatest?.meter_time || meterLatest?.created_at),
      example: text(meterLatest?.cnc_machine_id || meterLatest?.machine_id),
    },
    {
      source: 'WMS 線邊庫資料',
      count: data.inventory.length,
      latest: formatTime(inventoryLatest?.snapshot_time || inventoryLatest?.created_at || inventoryLatest?.updated_at),
      example: text(inventoryLatest?.material_code || inventoryLatest?.item_code || inventoryLatest?.sku_code),
    },
    {
      source: 'MES / 製令流程卡',
      count: data.runCardHeaders.length,
      latest: formatTime(runCardLatest?.created_at || runCardLatest?.updated_at || runCardLatest?.run_card_time),
      example: text(runCardLatest?.run_card_no || runCardLatest?.work_order_no),
    },
  ]

  const predictionRows = data.predictions.slice(0, 5)
  const actionRows = data.actions.slice(0, 5)
  const rewardRows = data.rewards.slice(0, 5)

  const modelFileRows = data.modelStatus ? [
    {
      stage: 'PyTorch - LSTM',
      file: 'lstm_quantity_forecast.pt',
      exists: data.modelStatus?.lstm_quantity_forecast?.exists ? '是' : '否',
      size: text(data.modelStatus?.lstm_quantity_forecast?.size_bytes),
    },
    {
      stage: 'PyTorch - DQN',
      file: 'dqn_scheduler_policy.pt',
      exists: data.modelStatus?.dqn_scheduler_policy?.exists ? '是' : '否',
      size: text(data.modelStatus?.dqn_scheduler_policy?.size_bytes),
    },
    ...toArray(data.workflow?.model_files)
      .filter((item) => ['dqn_scheduler_policy.onnx', 'lstm_quantity_forecast.onnx', 'dqn_scheduler_policy.engine'].includes(item.filename))
      .map((item) => ({
        stage: item.filename.endsWith('.engine') ? 'TensorRT' : 'ONNX',
        file: item.filename,
        exists: item.exists ? '是' : '否',
        size: text(item.size_bytes),
      })),
  ] : []

  const stepOverviewRows = [
    { no: 1, name: '資料輸入層', status: inputSummaryRows.some((r) => Number(r.count) > 0) ? '可看' : '待補', page: 'CNC 智慧電表 / ERP 製令單 / WMS 線邊庫 / 製令流程卡' },
    { no: 2, name: '資料治理與特徵工程', status: featureEngineeringRows.length ? '可看' : '待補', page: 'AIPS 1-10 流程驗證 / 模型優化 / 部署' },
    { no: 3, name: 'LSTM 產量預測', status: predictionRows.length ? '可看' : '待補', page: 'AI 生產預測' },
    { no: 4, name: 'ARIMA 時間序列預測', status: predictionRows.length ? '可看' : '待補', page: 'AI 生產預測 / 模型優化 / 部署' },
    { no: 5, name: 'Prediction Fusion', status: predictionRows.length && stateFeatureRows.length ? '可看' : '待補', page: 'AIPS 1-10 流程驗證' },
    { no: 6, name: 'DQN State', status: stateFeatureRows.length ? '可看' : '待補', page: 'DQN State' },
    { no: 7, name: 'DQN Q-Network', status: modelFileRows.length ? '可看' : '待補', page: '模型檔案狀態 / 模型優化 / 部署' },
    { no: 8, name: 'Action 決策', status: actionRows.length ? '可看' : '待補', page: 'DQN 排程 Action' },
    { no: 9, name: 'MES 執行層', status: data.runCardHeaders.length ? '可看' : '待補', page: '製令流程卡 / AI / 即時事件' },
    { no: 10, name: 'Reward 計算回饋', status: rewardRows.length ? '可看' : '待補', page: 'Reward 回饋 / DQN Reward 說明' },
  ]

  return (
    <div className="page">
      <PageHeader
        title="AIPS 1-10 流程驗證"
        subtitle="將 1-10 流程集中到一頁查看；不取代原本頁面，而是作為 Demo 驗證總覽。"
      >
        <button onClick={load}>{loading ? '重新整理中...' : '重新整理'}</button>
      </PageHeader>

      <div className="card">
        <h2>AIPS 1-10 架構總覽</h2>
        <p>此圖對照整體流程：資料輸入 → 特徵工程 → LSTM / ARIMA → Prediction Fusion → DQN State → Q-Network → Action → MES → Reward。</p>
        <img
          src={flowImage}
          alt="AIPS 1-10 flow"
          className="aips-flow-image"
        />
      </div>

      <div className="card">
        <h2>1-10 驗證總表</h2>
        <DataTable
          columns={['no', 'name', 'status', 'page']}
          labels={{ no: '步驟', name: '流程', status: '目前狀態', page: '主要觀看頁面' }}
          rows={stepOverviewRows}
          pageable={false}
        />
      </div>

      <div className="flow-stat-grid">
        <SmallStat title="ERP 製令資料" value={data.workOrders.length} note={`最新：${formatTime(workOrderLatest?.snapshot_time || workOrderLatest?.created_at || workOrderLatest?.updated_at)}`} />
        <SmallStat title="CNC / 智慧電表" value={data.meterRows.length} note={`最新：${formatTime(meterLatest?.event_time || meterLatest?.meter_time || meterLatest?.created_at)}`} />
        <SmallStat title="WMS 線邊庫" value={data.inventory.length} note={`最新：${formatTime(inventoryLatest?.snapshot_time || inventoryLatest?.created_at || inventoryLatest?.updated_at)}`} />
        <SmallStat title="DQN Reward" value={data.rewards.length} note={`最新：${formatTime(rewardLatest?.reward_time || rewardLatest?.created_at)}`} />
      </div>

      <SectionCard no={1} title="資料輸入層" pageName="CNC 智慧電表 / ERP 製令單 / WMS 線邊庫 / 製令流程卡 / AI" ready={inputSummaryRows.some((row) => Number(row.count) > 0)}>
        <DataTable
          columns={['source', 'count', 'latest', 'example']}
          labels={{ source: '來源', count: '筆數', latest: '最新時間', example: '範例資料' }}
          rows={inputSummaryRows}
          pageable={false}
        />
      </SectionCard>

      <SectionCard no={2} title="資料治理與特徵工程" pageName="AIPS 1-10 流程驗證 / 模型優化 / 部署" ready={featureEngineeringRows.length > 0}>
        <p className="flow-help-text">目前頁面直接列出已能看到的特徵欄位，對應 OEE、THD、稼動率、缺料、交期壓力、前後工序與能耗等資訊。</p>
        {featureEngineeringRows.length ? (
          <DataTable
            columns={['field', 'value']}
            labels={{ field: '特徵欄位', value: '目前值 / 範例值' }}
            rows={featureEngineeringRows}
            pageable={false}
          />
        ) : (
          <div className="empty-image">目前尚未抓到特徵欄位資料</div>
        )}
      </SectionCard>

      <SectionCard no={3} title="LSTM 產量預測模型" pageName="AI 生產預測" ready={predictionRows.length > 0}>
        <p className="flow-help-text">重點看：預測產量、預測良品量、預測不良量、良率、信心分數。</p>
        <DataTable
          columns={['work_order_no', 'cnc_machine_id', 'predicted_value', 'predicted_good_qty', 'predicted_ng_qty', 'predicted_yield_rate', 'confidence_score']}
          labels={{
            work_order_no: '製令單',
            cnc_machine_id: 'CNC',
            predicted_value: '預測產量',
            predicted_good_qty: '良品量',
            predicted_ng_qty: '不良量',
            predicted_yield_rate: '良率',
            confidence_score: '信心分數',
          }}
          rows={predictionRows}
        />
      </SectionCard>

      <SectionCard no={4} title="ARIMA 時間序列預測" pageName="AI 生產預測 / 模型優化 / 部署" ready={predictionRows.length > 0}>
        <p className="flow-help-text">目前專案中用預測資料中的完成時間、缺料風險、能耗等欄位來展示 ARIMA 趨勢輸出結果。</p>
        <DataTable
          columns={['work_order_no', 'predicted_finish_time', 'predicted_material_shortage_risk', 'predicted_energy_consumption_kwh', 'capacity_utilization_rate']}
          labels={{
            work_order_no: '製令單',
            predicted_finish_time: '預估完成時間',
            predicted_material_shortage_risk: '缺料風險',
            predicted_energy_consumption_kwh: '預估耗電 kWh',
            capacity_utilization_rate: '產能利用率',
          }}
          rows={predictionRows}
        />
      </SectionCard>

      <SectionCard no={5} title="預測結果融合層 (Prediction Fusion)" pageName="AIPS 1-10 流程驗證" ready={predictionRows.length > 0 && stateFeatureRows.length > 0}>
        <div className="flow-fusion-grid">
          <div className="flow-fusion-card">
            <h3>LSTM / ARIMA 輸出</h3>
            <ul>
              <li>predicted_output_qty：{text(predictionLatest?.predicted_value)}</li>
              <li>predicted_yield_rate：{text(predictionLatest?.predicted_yield_rate)}</li>
              <li>predicted_finish_time：{text(predictionLatest?.predicted_finish_time)}</li>
              <li>predicted_energy_consumption_kwh：{text(predictionLatest?.predicted_energy_consumption_kwh)}</li>
            </ul>
          </div>
          <div className="flow-fusion-card">
            <h3>融合後進入 DQN State</h3>
            <ul>
              <li>remaining_qty：{text(stateLatest?.remaining_qty)}</li>
              <li>due_pressure：{text(stateLatest?.due_pressure || stateLatest?.delay_risk_score)}</li>
              <li>shortage_risk：{text(stateLatest?.shortage_risk || stateLatest?.shortage_risk_score)}</li>
              <li>priority_level：{text(stateLatest?.priority_level)}</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard no={6} title="DQN State (狀態向量)" pageName="DQN State" ready={stateFeatureRows.length > 0}>
        {stateFeatureRows.length ? (
          <DataTable
            columns={['field', 'value']}
            labels={{ field: 'State 欄位', value: '目前值 / 範例值' }}
            rows={stateFeatureRows}
            pageable={false}
          />
        ) : (
          <div className="empty-image">目前尚未產生 DQN State</div>
        )}
      </SectionCard>

      <SectionCard no={7} title="DQN Q-Network" pageName="模型檔案狀態 / 模型優化 / 部署" ready={modelFileRows.length > 0}>
        <p className="flow-help-text">這裡集中顯示 PyTorch、ONNX、TensorRT 相關檔案，代表 Q-Network 與部署模型目前能否被查看。</p>
        <DataTable
          columns={['stage', 'file', 'exists', 'size']}
          labels={{ stage: '階段', file: '檔名', exists: '存在', size: '大小 bytes' }}
          rows={modelFileRows}
          pageable={false}
        />
      </SectionCard>

      <SectionCard no={8} title="ACTION 決策 (排程動作)" pageName="DQN 排程 Action" ready={actionRows.length > 0}>
        <DataTable
          columns={['work_order_no', 'original_cnc_machine_id', 'suggested_cnc_machine_id', 'action_name', 'action_reason', 'action_confidence_score', 'action_status']}
          labels={{
            work_order_no: '製令單',
            original_cnc_machine_id: '原機台',
            suggested_cnc_machine_id: '建議機台',
            action_name: 'Action',
            action_reason: '原因',
            action_confidence_score: '信心',
            action_status: '狀態',
          }}
          rows={actionRows}
        />
      </SectionCard>

      <SectionCard no={9} title="執行層 (MES)" pageName="製令流程卡 / AI / 即時事件" ready={data.runCardHeaders.length > 0}>
        <p className="flow-help-text">此區用製令流程卡資料代表 MES 執行層成果，對照現場派工 / 加工進度。</p>
        <DataTable
          columns={['run_card_no', 'work_order_no', 'cnc_machine_id', 'status', 'created_at', 'updated_at']}
          labels={{
            run_card_no: '流程卡',
            work_order_no: '製令單',
            cnc_machine_id: 'CNC',
            status: '狀態',
            created_at: '建立時間',
            updated_at: '更新時間',
          }}
          rows={data.runCardHeaders.slice(0, 5)}
        />
      </SectionCard>

      <SectionCard no={10} title="Reward 計算與回饋" pageName="Reward 回饋 / DQN Reward 說明" ready={rewardRows.length > 0}>
        <p className="flow-help-text">Reward 用來驗證 Action 是否真的改善排程，這裡直接看 Reward 紀錄與關鍵結果欄位。</p>
        <DataTable
          columns={['work_order_no', 'reward_score', 'oee_improvement_rate', 'delay_minutes_saved', 'energy_saving_rate', 'actual_oee', 'actual_yield_rate']}
          labels={{
            work_order_no: '製令單',
            reward_score: 'Reward',
            oee_improvement_rate: 'OEE 改善率',
            delay_minutes_saved: '節省延遲分鐘',
            energy_saving_rate: '節能率',
            actual_oee: '實際 OEE',
            actual_yield_rate: '實際良率',
          }}
          rows={rewardRows}
        />
      </SectionCard>
    </div>
  )
}
