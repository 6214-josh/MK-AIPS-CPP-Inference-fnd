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
  const [running, setRunning] = useState('')
  const [message, setMessage] = useState('')
  const [flowResult, setFlowResult] = useState(null)
  const [data, setData] = useState({
    sources: [],
    features: [],
    downstream: [],
    feedback: null,
    predictions: [],
    states: [],
    actions: [],
    rewards: [],
  })

  async function load() {
    setLoading(true)
    try {
      const [
        sources,
        features,
        downstream,
        feedback,
        predictions,
        states,
        actions,
        rewards,
      ] = await Promise.all([
        apiClient.get('/aips/data-engineering/sources').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/aips/data-engineering/features/latest?limit=100').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/aips/data-engineering/downstream-summary').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/aips/data-engineering/feedback-summary').then((r) => r.data).catch(() => null),
        apiClient.get('/aips/predictions/latest').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/aips/states/latest').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/aips/dqn/actions/latest').then((r) => toArray(r.data)).catch(() => []),
        apiClient.get('/aips/rewards/latest').then((r) => toArray(r.data)).catch(() => []),
      ])

      setData({ sources, features, downstream, feedback, predictions, states, actions, rewards })
    } finally {
      setLoading(false)
    }
  }

  async function runApi(label, url) {
    setRunning(label)
    setMessage('')
    try {
      const res = await apiClient.post(url)
      setMessage(res.data.message || `${label} 完成`)
      setFlowResult(res.data)
      await load()
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || `${label} 失敗`
      setMessage(detail)
      alert(detail)
    } finally {
      setRunning('')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sourceMap = useMemo(() => {
    const map = {}
    data.sources.forEach((row) => { map[row.source_table] = row })
    return map
  }, [data.sources])

  const featureRows = data.features.slice(0, 20)
  const downstreamRows = data.downstream.map((row) => ({
    ...row,
    latest_feature_time: formatTime(row.latest_feature_time),
  }))

  const stepOverviewRows = [
    { no: 1, name: '資料輸入層', status: Number(sourceMap.cnc_meter_raw_data?.record_count || 0) > 0 ? '可看' : '待補', page: '模擬硬體 / ERP / WMS / MES' },
    { no: 2, name: '資料治理與特徵工程', status: Number(sourceMap.aips_data_engineering_feature?.record_count || 0) > 0 ? '可看' : '待補', page: '本頁：資料工程特徵池' },
    { no: 3, name: 'LSTM 產量預測', status: data.predictions.length ? '可看' : '待補', page: 'AI 生產預測' },
    { no: 4, name: 'ARIMA 時間序列預測', status: data.features.some((f) => text(f.downstream_stage).includes('ARIMA')) ? '可看' : '待補', page: '本頁 / 製令流程卡 / AI' },
    { no: 5, name: 'Prediction Fusion', status: data.downstream.some((r) => text(r.downstream_stage).includes('FUSION')) ? '可看' : '待補', page: '本頁：downstream summary' },
    { no: 6, name: 'DQN State', status: data.states.length ? '可看' : '待補', page: 'DQN State' },
    { no: 7, name: 'DQN Q-Network', status: data.actions.length ? '可看' : '待補', page: 'DQN 排程 Action / 模型優化' },
    { no: 8, name: 'Action 決策', status: data.actions.length ? '可看' : '待補', page: 'DQN 排程 Action' },
    { no: 9, name: 'MES 執行層', status: Number(sourceMap.aips_run_card_detail?.record_count || 0) > 0 ? '可看' : '待補', page: '製令流程卡 / AI / 即時事件' },
    { no: 10, name: 'Reward 回饋', status: data.rewards.length ? '可看' : '待補', page: 'Reward 回饋' },
    { no: 11, name: '回饋循環', status: Number(data.feedback?.feedback_count || 0) > 0 ? '可看' : '待補', page: 'Step10 → Step1 → Step2 → Step3~10' },
  ]

  return (
    <div className="page">
      <PageHeader
        title="AIPS 1-10 流程驗證"
        subtitle="全棧實作：Step1 模擬硬體資料 → Step2 資料工程 → Step3~10 AI / DQN / Reward，並將 Reward 回饋 Step1/2。"
      >
        <button onClick={load}>{loading ? '重新整理中...' : '重新整理'}</button>
      </PageHeader>

      <div className="card">
        <h2>AIPS 1-10 架構圖</h2>
        <p>本頁的按鈕會真的呼叫後端 API，從模擬硬體抓資料、建立資料工程特徵、往後塞給 Step3~10，最後 Reward 再回饋 Step1 / Step2。</p>
        <img src={flowImage} alt="AIPS 1-10 flow" className="aips-flow-image" />
      </div>

      <div className="card">
        <h2>一鍵操作</h2>
        <div className="action-grid">
          <button disabled={!!running} onClick={() => runApi('Step1 模擬硬體資料輸入', '/aips/data-engineering/step1-hardware-ingest')}>
            1. 跑 Step1 硬體資料輸入
          </button>
          <button disabled={!!running} onClick={() => runApi('Step2 資料工程', '/aips/data-engineering/step2-feature-engineering')}>
            2. 跑 Step2 資料工程
          </button>
          <button className="primary-btn" disabled={!!running} onClick={() => runApi('AIPS 1-10 全流程', '/aips/data-engineering/run-full-flow')}>
            3. 跑 AIPS 1-10 全流程 + 回饋循環
          </button>
        </div>
        {running && <div className="export-message">正在執行：{running}，請稍候...</div>}
        {message && <div className="export-message">操作結果：{message}</div>}
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
        <SmallStat title="Step1 原始電表資料" value={sourceMap.cnc_meter_raw_data?.record_count || 0} note={`最新：${formatTime(sourceMap.cnc_meter_raw_data?.latest_created_at)}`} />
        <SmallStat title="Step2 資料工程特徵" value={sourceMap.aips_data_engineering_feature?.record_count || 0} note={`最新：${formatTime(sourceMap.aips_data_engineering_feature?.latest_created_at)}`} />
        <SmallStat title="Step3/4 預測資料" value={sourceMap.aips_production_prediction?.record_count || 0} note={`最新：${formatTime(sourceMap.aips_production_prediction?.latest_created_at)}`} />
        <SmallStat title="Step10 Reward 回饋" value={sourceMap.aips_reward_result?.record_count || 0} note={`回饋特徵：${data.feedback?.feedback_count || 0}`} />
      </div>

      <SectionCard no={1} title="資料輸入層：模擬硬體 / ERP / WMS / MES" pageName="硬體模擬器、CNC 智慧電表、ERP 製令單、WMS 線邊庫、製令流程卡" ready={Number(sourceMap.cnc_meter_raw_data?.record_count || 0) > 0}>
        <DataTable
          columns={['source_table', 'description', 'record_count', 'latest_created_at']}
          labels={{ source_table: '資料表', description: '來源說明', record_count: '筆數', latest_created_at: '最新時間' }}
          rows={data.sources.map((row) => ({ ...row, latest_created_at: formatTime(row.latest_created_at) }))}
          pageable={false}
        />
      </SectionCard>

      <SectionCard no={2} title="資料治理與特徵工程：Step1 → Step2" pageName="本頁資料工程特徵池" ready={featureRows.length > 0}>
        <p className="flow-help-text">這裡顯示從模擬硬體、ERP、WMS、MES 清洗/正規化後的特徵，並標示會餵給哪個後續階段。</p>
        <DataTable
          columns={['data_feature_id', 'feature_category', 'feature_name', 'cnc_machine_id', 'work_order_no', 'normalized_value', 'downstream_stage']}
          labels={{ data_feature_id: 'ID', feature_category: '類別', feature_name: '特徵', cnc_machine_id: 'CNC', work_order_no: '製令單', normalized_value: '正規化值', downstream_stage: '送往階段' }}
          rows={featureRows}
        />
      </SectionCard>

      <SectionCard no={3} title="LSTM 產量預測" pageName="AI 生產預測" ready={data.predictions.length > 0}>
        <DataTable
          columns={['work_order_no', 'cnc_machine_id', 'predicted_value', 'predicted_good_qty', 'predicted_ng_qty', 'predicted_yield_rate', 'confidence_score']}
          labels={{ work_order_no: '製令單', cnc_machine_id: 'CNC', predicted_value: '預測產量', predicted_good_qty: '良品量', predicted_ng_qty: '不良量', predicted_yield_rate: '良率', confidence_score: '信心' }}
          rows={data.predictions.slice(0, 8)}
        />
      </SectionCard>

      <SectionCard no={4} title="ARIMA 時間序列預測" pageName="資料工程特徵池 / 製令流程卡 AI 特徵" ready={data.features.some((f) => text(f.downstream_stage).includes('ARIMA'))}>
        <DataTable
          columns={['feature_category', 'feature_name', 'cleaned_value', 'normalized_value', 'downstream_stage']}
          labels={{ feature_category: '類別', feature_name: '特徵', cleaned_value: '清洗值', normalized_value: '正規化值', downstream_stage: '送往階段' }}
          rows={data.features.filter((f) => text(f.downstream_stage).includes('ARIMA')).slice(0, 10)}
        />
      </SectionCard>

      <SectionCard no={5} title="Prediction Fusion：LSTM / ARIMA + 資料工程特徵融合" pageName="本頁 downstream summary" ready={data.downstream.length > 0}>
        <DataTable
          columns={['downstream_stage', 'feature_count', 'latest_feature_time']}
          labels={{ downstream_stage: '送往階段', feature_count: '特徵筆數', latest_feature_time: '最新時間' }}
          rows={downstreamRows}
          pageable={false}
        />
      </SectionCard>

      <SectionCard no={6} title="DQN State 狀態向量" pageName="DQN State" ready={data.states.length > 0}>
        <DataTable
          columns={['state_id', 'work_order_no', 'cnc_machine_id', 'machine_status', 'delay_risk_score', 'shortage_risk_score', 'quality_risk_score', 'current_oee']}
          labels={{ state_id: 'State', work_order_no: '製令單', cnc_machine_id: 'CNC', machine_status: '機台狀態', delay_risk_score: '延遲風險', shortage_risk_score: '缺料風險', quality_risk_score: '品質風險', current_oee: 'OEE' }}
          rows={data.states.slice(0, 8)}
        />
      </SectionCard>

      <SectionCard no={7} title="DQN Q-Network" pageName="DQN 排程 Action / 模型優化" ready={data.actions.length > 0}>
        <p className="flow-help-text">DQN 由 Step6 State 進入 Q-Network，輸出 Action 與信心分數；詳細 Q value 可在 Action reason 內看到。</p>
        <DataTable
          columns={['action_id', 'work_order_no', 'original_cnc_machine_id', 'suggested_cnc_machine_id', 'action_name', 'action_confidence_score']}
          labels={{ action_id: 'Action', work_order_no: '製令單', original_cnc_machine_id: '原機台', suggested_cnc_machine_id: '建議機台', action_name: 'Action', action_confidence_score: '信心' }}
          rows={data.actions.slice(0, 8)}
        />
      </SectionCard>

      <SectionCard no={8} title="Action 決策" pageName="DQN 排程 Action" ready={data.actions.length > 0}>
        <DataTable
          columns={['action_id', 'action_type', 'action_name', 'action_reason', 'action_status']}
          labels={{ action_id: 'ID', action_type: '類型', action_name: '建議', action_reason: '原因', action_status: '狀態' }}
          rows={data.actions.slice(0, 8)}
        />
      </SectionCard>

      <SectionCard no={9} title="MES 執行層" pageName="製令流程卡 / AI、即時事件" ready={Number(sourceMap.aips_run_card_detail?.record_count || 0) > 0}>
        <p className="flow-help-text">以製令流程卡與即時事件模擬 MES 執行結果，供 Step10 Reward 驗證。</p>
        <DataTable
          columns={['source_table', 'description', 'record_count', 'latest_created_at']}
          labels={{ source_table: '資料表', description: '說明', record_count: '筆數', latest_created_at: '最新時間' }}
          rows={data.sources.filter((row) => ['aips_run_card_detail', 'aips_scan_event'].includes(row.source_table)).map((row) => ({ ...row, latest_created_at: formatTime(row.latest_created_at) }))}
          pageable={false}
        />
      </SectionCard>

      <SectionCard no={10} title="Reward 計算與回饋" pageName="Reward 回饋" ready={data.rewards.length > 0}>
        <DataTable
          columns={['reward_id', 'work_order_no', 'cnc_machine_id', 'reward_score', 'actual_oee', 'actual_yield_rate', 'energy_saving_rate']}
          labels={{ reward_id: 'Reward', work_order_no: '製令單', cnc_machine_id: 'CNC', reward_score: '總分', actual_oee: '實際 OEE', actual_yield_rate: '實際良率', energy_saving_rate: '節能率' }}
          rows={data.rewards.slice(0, 8)}
        />
      </SectionCard>

      <SectionCard no={11} title="回饋循環：Step10 → Step1 → Step2 → Step3~10" pageName="本頁 feedback summary" ready={Number(data.feedback?.feedback_count || 0) > 0}>
        <p className="flow-help-text">Reward 不是結束，而是寫回資料工程特徵池，形成下一輪 Step1/Step2 的回饋特徵，讓後續 DQN State / Action 可持續修正。</p>
        <pre className="code-block">{JSON.stringify(data.feedback || {}, null, 2)}</pre>
      </SectionCard>

      {flowResult && (
        <div className="card">
          <h2>最近一次全流程執行結果</h2>
          <pre className="code-block">{JSON.stringify(flowResult, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
