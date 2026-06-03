import React, { useEffect, useMemo, useState } from 'react'
import apiClient from '../api/apiClient'
import DataTable from './DataTable.jsx'

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>

      <div className="toolbar">
        {children}
      </div>
    </div>
  )
}

export function showError(err) {
  const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'API 發生錯誤'
  alert(detail)
  throw err
}

export function AipsStatePanel() {
  const [rows, setRows] = useState([])
  const columns = ['state_id','state_time','work_order_no','cnc_machine_id','machine_status','shortage_risk_score','delay_risk_score','quality_risk_score','power_risk_score']
  async function load(){ setRows((await apiClient.get('/aips/states/latest')).data || []) }
  async function run(){ await apiClient.post('/aips/states/build'); await load() }
  useEffect(()=>{ load() }, [])
  return <div className="page"><PageHeader title="DQN State 狀態特徵"><button onClick={run}>建立 DQN State</button><button onClick={load}>重新整理</button></PageHeader><div className="card"><DataTable columns={columns} rows={rows}/></div></div>
}

export function DqnActionPanel() {
  const [rows, setRows] = useState([])
  const [gpuHealth, setGpuHealth] = useState(null)
  const columns = ['action_id','action_time','work_order_no','original_cnc_machine_id','suggested_cnc_machine_id','action_type','action_name','action_reason','action_confidence_score','action_status']
  const labels = { action_id:'編號', action_time:'時間', work_order_no:'製令單', original_cnc_machine_id:'原機台', suggested_cnc_machine_id:'建議機台', action_type:'類型', action_name:'建議', action_reason:'原因', action_confidence_score:'信心', action_status:'狀態' }
  async function load(){ setRows((await apiClient.get('/aips/dqn/actions/latest')).data || []) }
  async function loadGpuHealth(){ setGpuHealth((await apiClient.get('/aips/dqn/gpu-health')).data || null) }
  async function generate(){ await apiClient.post('/aips/dqn/generate-actions'); await load(); await loadGpuHealth() }
  useEffect(()=>{ load(); loadGpuHealth() }, [])
  const gpuStatusText = gpuHealth ? `${gpuHealth.engine || 'CUDA Driver API 推論服務'}：${gpuHealth.status || '-'}${gpuHealth.url ? `｜${gpuHealth.url}` : ''}${gpuHealth.error ? `｜${gpuHealth.error}` : ''}` : '檢查中'
  return <div className="page"><PageHeader title="DQN 排程Action" subtitle="依據 DQN State 產生提高優先權、換機、補料、預防保養等建議。可優先呼叫獨立 C++ CUDA Driver API 推論服務。"><button className="primary-btn" onClick={generate}>產生 DQN 建議</button><button onClick={load}>重新整理</button><button onClick={loadGpuHealth}>檢查 GPU 推論服務</button></PageHeader><div className="card"><strong>GPU 推論服務狀態：</strong><div>{gpuStatusText}</div></div><div className="card"><DataTable columns={columns} rows={rows} labels={labels}/></div></div>
}

export function PredictionPanel() {
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState('')
  const columns = [
    'prediction_id',
    'prediction_time',
    'work_order_no',
    'cnc_machine_id',
    'prediction_type',
    'predicted_value',
    'predicted_good_qty',
    'predicted_ng_qty',
    'predicted_yield_rate',
    'capacity_utilization_rate',
    'confidence_score',
    'predicted_finish_time',
    'predicted_material_shortage_risk',
    'predicted_energy_consumption_kwh',
    'model_name'
  ]
  const labels = {
    prediction_id: '編號',
    prediction_time: '時間',
    work_order_no: '製令單',
    cnc_machine_id: 'CNC',
    prediction_type: '預測類型',
    predicted_value: '預測產量',
    predicted_good_qty: '預測良品量',
    predicted_ng_qty: '預測不良量',
    predicted_yield_rate: '預測良率',
    capacity_utilization_rate: '產能利用率',
    confidence_score: '信心分數',
    predicted_finish_time: '預估完成時間',
    predicted_material_shortage_risk: '缺料風險',
    predicted_energy_consumption_kwh: '預估耗電kWh',
    model_name: '模型'
  }
  async function load(){ setRows((await apiClient.get('/aips/predictions/latest')).data || []) }
  async function run(){
    const res = await apiClient.post('/aips/predictions/run').catch(showError)
    setMessage(res?.data?.message || `已新增 ${res?.data?.created_count || 0} 筆 AI 產量預測`)
    await load()
  }
  useEffect(()=>{ load() }, [])
  return (
    <div className="page">
      <PageHeader title="AI 生產預測" subtitle="此頁重點顯示「產量預測」：預測產量、良品量、不良量、良率、產能利用率與信心分數。">
        <button className="primary-btn" onClick={run}>執行 LSTM / ARIMA 產量預測</button>
        <button onClick={load}>重新整理</button>
      </PageHeader>
      {message && <div className="export-message">{message}</div>}
      <div className="card">
        <DataTable columns={columns} rows={rows} labels={labels}/>
      </div>
    </div>
  )
}


export function RewardPanel() {
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState('')
  const columns = [
    'reward_id',
    'reward_time',
    'action_id',
    'work_order_no',
    'cnc_machine_id',
    'reward_score',
    'oee_improvement_rate',
    'delay_minutes_saved',
    'energy_saving_rate',
    'actual_oee',
    'actual_yield_rate'
  ]
  const labels = {
    reward_id: '編號',
    reward_time: '時間',
    action_id: 'Action',
    work_order_no: '製令單',
    cnc_machine_id: 'CNC',
    reward_score: 'Reward總分',
    oee_improvement_rate: 'OEE改善率',
    delay_minutes_saved: '節省延遲分鐘',
    energy_saving_rate: '節能率',
    actual_oee: '實際OEE',
    actual_yield_rate: '良率'
  }

  async function load(){
    setRows((await apiClient.get('/aips/rewards/latest')).data || [])
  }

  async function run(){
    const res = await apiClient.post('/aips/rewards/calculate?limit=20').catch(showError)
    setMessage(res?.data?.message || `已新增 ${res?.data?.created_count || 0} 筆 Reward`)
    await load()
  }

  useEffect(()=>{ load() }, [])

  return (
    <div className="page">
      <PageHeader title="DQN Reward 回饋" subtitle="Reward 由 OEE、交期、缺料、品質、能源組成，用來回饋 DQN Action 是否真的改善排程。">
        <button className="primary-btn" onClick={run}>計算 Reward</button>
        <button onClick={load}>重新整理</button>
      </PageHeader>
      {message && <div className="export-message">{message}</div>}
      <div className="card">
        <DataTable columns={columns} rows={rows} labels={labels}/>
      </div>
    </div>
  )
}


export function LoginAuthPanel() {
  const emptyForm = {
    user_id: '',
    username: '',
    display_name: '',
    role_name: 'VIEWER',
    password_text: '123456',
    enabled_flag: true
  }

  const [rows, setRows] = useState([])
  const [logs, setLogs] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [message, setMessage] = useState('')

  const columns = ['user_id','username','display_name','role_name','enabled_flag','last_login_time']
  const labels = {
    user_id: '編號',
    username: '帳號',
    display_name: '顯示名稱',
    role_name: '角色',
    enabled_flag: '啟用',
    last_login_time: '最後登入'
  }

  const logColumns = ['login_id','login_time','username','login_status','client_ip','message']
  const logLabels = {
    login_id: '編號',
    login_time: '登入時間',
    username: '帳號',
    login_status: '狀態',
    client_ip: 'IP',
    message: '訊息'
  }

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setMessage('')
  }

  async function load() {
    const userRes = await apiClient.get('/auth/users').catch(showError)
    const logRes = await apiClient.get('/auth/login-logs').catch(showError)
    setRows(userRes?.data || [])
    setLogs(logRes?.data || [])
  }

  async function createDemo() {
    const res = await apiClient.post('/auth/users/demo').catch(showError)
    setMessage(res.data.message || 'Demo 使用者已新增')
    await load()
  }

  async function submitUser() {
    const payload = {
      username: form.username,
      display_name: form.display_name,
      role_name: form.role_name,
      password_text: form.password_text,
      enabled_flag: !!form.enabled_flag
    }

    if (!payload.username || !payload.display_name) {
      alert('帳號與顯示名稱必填')
      return
    }

    if (editingId) {
      const res = await apiClient.put(`/auth/users/${editingId}`, payload).catch(showError)
      setMessage(res.data.message || '使用者已更新')
    } else {
      const res = await apiClient.post('/auth/users', payload).catch(showError)
      setMessage(res.data.message || '使用者已新增')
    }

    resetForm()
    await load()
  }

  function editUser(row) {
    setEditingId(row.user_id)
    setForm({
      user_id: row.user_id,
      username: row.username || '',
      display_name: row.display_name || '',
      role_name: row.role_name || 'VIEWER',
      password_text: '',
      enabled_flag: !!row.enabled_flag
    })
    setMessage(`正在編輯：${row.username}`)
  }

  async function toggleUser(row) {
    const res = await apiClient.patch(`/auth/users/${row.user_id}/toggle`).catch(showError)
    setMessage(res.data.message || '啟用狀態已切換')
    await load()
  }

  async function resetPassword(row) {
    if (!confirm(`確定將 ${row.username} 密碼重設為 123456？`)) return
    const res = await apiClient.patch(`/auth/users/${row.user_id}/reset-password`).catch(showError)
    setMessage(res.data.message || '密碼已重設')
    await load()
  }

  async function deleteUser(row) {
    if (!confirm(`確定刪除使用者：${row.username}？`)) return
    const res = await apiClient.delete(`/auth/users/${row.user_id}`).catch(showError)
    setMessage(res.data.message || '使用者已刪除')
    await load()
  }

  useEffect(() => { load() }, [])

  return (
    <div className="page">
      <PageHeader title="登入 / 權限管理" subtitle="使用者帳號 CRUD 管理；Demo 帳號：admin、operator01、planner01。">
        <button className="primary-btn" onClick={createDemo}>新增 Demo 使用者</button>
        <button onClick={resetForm}>清空表單</button>
        <button onClick={load}>重新整理</button>
      </PageHeader>

      {message && <div className="export-message">{message}</div>}

      <div className="card">
        <h2>{editingId ? '編輯使用者' : '新增使用者'}</h2>
        <div className="form-grid user-crud-form">
          <label>
            帳號
            <input value={form.username} onChange={e => updateForm('username', e.target.value)} placeholder="例如 user01" />
          </label>
          <label>
            顯示名稱
            <input value={form.display_name} onChange={e => updateForm('display_name', e.target.value)} placeholder="例如 現場作業員" />
          </label>
          <label>
            角色
            <select value={form.role_name} onChange={e => updateForm('role_name', e.target.value)}>
              <option value="ADMIN">ADMIN 系統管理員</option>
              <option value="PLANNER">PLANNER 生管排程人員</option>
              <option value="OPERATOR">OPERATOR 現場操作員</option>
              <option value="VIEWER">VIEWER 檢視者</option>
            </select>
          </label>
          <label>
            密碼
            <input type="text" value={form.password_text} onChange={e => updateForm('password_text', e.target.value)} placeholder={editingId ? '空白表示不變更密碼' : '預設 123456'} />
          </label>
          <label className="enabled-field">
            啟用
            <div className="enabled-box">
              <input type="checkbox" checked={!!form.enabled_flag} onChange={e => updateForm('enabled_flag', e.target.checked)} />
              <span>{form.enabled_flag ? '是' : '否'}</span>
            </div>
          </label>
        </div>
        <div className="form-actions">
          <button className="primary-btn" onClick={submitUser}>{editingId ? '儲存修改' : '新增使用者'}</button>
          {editingId && <button onClick={resetForm}>取消編輯</button>}
        </div>
      </div>

      <div className="card">
        <h2>使用者清單</h2>
        <DataTable
          columns={columns}
          rows={rows}
          labels={labels}
          renderActions={(row) => (
            <div className="table-actions">
              <button onClick={() => editUser(row)}>編輯</button>
              <button onClick={() => toggleUser(row)}>{row.enabled_flag ? '停用' : '啟用'}</button>
              <button onClick={() => resetPassword(row)}>重設密碼</button>
              <button className="danger-outline-btn" onClick={() => deleteUser(row)}>刪除</button>
            </div>
          )}
        />
      </div>

      <div className="card">
        <h2>登入紀錄</h2>
        <DataTable columns={logColumns} rows={logs} labels={logLabels} />
      </div>
    </div>
  )
}


export function HardwareSimulatorOverview() {
  const [modules, setModules] = useState([])
  const [flow, setFlow] = useState([])

  const columns = ['hardware_module', 'simulator_api', 'write_tables', 'aips_effect']
  const labels = {
    hardware_module: '硬體模組',
    simulator_api: '模擬 API',
    write_tables: '寫入資料表',
    aips_effect: '串接效果'
  }

  const rows = [
    {
      hardware_module: 'WiFi PDA / Android',
      simulator_api: '/api/hardware-simulator/pda/scan-demo',
      write_tables: 'aips_scan_event, aips_realtime_event_log',
      aips_effect: '形成現場掃描事件'
    },
    {
      hardware_module: 'NFC / QR Code 標籤',
      simulator_api: '/api/hardware-simulator/tags/scan-demo',
      write_tables: 'aips_scan_event, aips_sim_nfc_qrcode_tag',
      aips_effect: '識別員工、料件、工單、CNC 機台'
    },
    {
      hardware_module: 'CNC + 智慧電表',
      simulator_api: '/api/hardware-simulator/cnc/meter-demo/{cnc_machine_id}',
      write_tables: 'cnc_meter_raw_data, cnc_meter_feature',
      aips_effect: '轉成 AI 特徵，進入 DQN State'
    },
    {
      hardware_module: '線邊庫 / 人工物流',
      simulator_api: '/api/hardware-simulator/logistics/cart-demo',
      write_tables: 'aips_sim_line_side_logistics, line_side_inventory_snapshot',
      aips_effect: '更新線邊庫庫存，影響缺料風險'
    }
  ]

  async function load() {
    const res = await apiClient.get('/hardware-simulator/overview')
    setModules(res.data.modules || [])
    setFlow(res.data.flow || [])
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">現場設備與作業區模擬器</h1>
          <p className="page-subtitle">
            WiFi PDA、NFC / QR Code、CNC 智慧電表、線邊庫人工物流，全部串到 FastAPI、PostgreSQL 與 AIPS 流程。
          </p>
        </div>
        <button onClick={load}>重新整理</button>
      </div>

      <div className="arch-grid">
        {modules.map((module) => (
          <div key={module.code} className="arch-card">
            <h2>{module.code}. {module.name}</h2>
            <p>{module.description}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>串接資料流</h2>
        <div className="flow-grid">
          {flow.map((step, index) => (
            <div key={step} className="flow-step">
              <strong>{index + 1}. {step}</strong>
              <span>模擬器寫入 PostgreSQL，並同步產生 AIPS 事件 / State / Action 所需資料。</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>與既有 AIPS 串接關係</h2>
        <DataTable columns={columns} rows={rows} labels={labels} />
      </div>
    </div>
  )
}



export function ModelStatusPanel() {
  const [status, setStatus] = useState(null)
  const [message, setMessage] = useState('')

  const columns = [
    'name',
    'file',
    'exists',
    'size_bytes',
    'updated_at',
    'path',
  ]

  const labels = {
    name: '模型',
    file: '檔名',
    exists: '是否存在',
    size_bytes: '大小 bytes',
    updated_at: '更新時間',
    path: '實際路徑',
  }

  async function load() {
    const res = await apiClient.get('/aips/models/status').catch(showError)
    setStatus(res?.data || null)
  }

  async function train() {
    setMessage('正在產生 LSTM / DQN 模型檔案...')
    const res = await apiClient.post('/aips/models/train-demo').catch(showError)
    setStatus(res?.data || null)
    setMessage('已產生模型檔案')
  }

  useEffect(() => {
    load()
  }, [])

  const rows = status ? [
    {
      name: 'LSTM 產量預測模型',
      file: 'models/lstm_quantity_forecast.pt',
      exists: status.lstm_quantity_forecast?.exists ? '是' : '否',
      path: status.lstm_quantity_forecast?.path,
      size_bytes: status.lstm_quantity_forecast?.size_bytes,
      updated_at: status.lstm_quantity_forecast?.updated_at,
    },
    {
      name: 'DQN 排程 Policy 模型',
      file: 'models/dqn_scheduler_policy.pt',
      exists: status.dqn_scheduler_policy?.exists ? '是' : '否',
      path: status.dqn_scheduler_policy?.path,
      size_bytes: status.dqn_scheduler_policy?.size_bytes,
      updated_at: status.dqn_scheduler_policy?.updated_at,
    },
    {
      name: '模型 metadata',
      file: 'models/model_metadata.json',
      exists: status.metadata?.exists ? '是' : '否',
      path: status.metadata?.path,
      size_bytes: status.metadata?.size_bytes,
      updated_at: status.metadata?.updated_at,
    },
  ] : []

  return (
    <div className="page">
      <PageHeader
        title="模型檔案狀態"
        subtitle="顯示 LSTM / DQN 模型是否已保存成實體檔案，供 Demo 指給委員看。"
      >
        <button className="primary-btn" onClick={train}>
          產生 / 重新訓練 Demo 模型檔
        </button>
        <button onClick={load}>重新整理</button>
      </PageHeader>

      {message && <div className="export-message">{message}</div>}

      {status && (
        <div className="card model-status-card">
          <div className="model-status-summary">
            <div>模型目錄：<code>{status.model_dir}</code></div>
            <div>PyTorch：{status.torch_available ? '已安裝' : '未安裝'}</div>
            <div>
              CUDA：
              {status.cuda_available ? `可用（${status.cuda_device}）` : '不可用 / CPU'}
            </div>
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            labels={labels}
            pageable={false}
          />
        </div>
      )}
    </div>
  )
}


export function ModelOptimizationPanel() {
  const [concerns, setConcerns] = useState(null)
  const [workflow, setWorkflow] = useState(null)

  const concernColumns = ['step', 'risk', 'impact']
  const concernLabels = {
    step: 'Concern',
    risk: '風險',
    impact: '可能影響',
  }

  const stepColumns = ['name', 'command', 'output', 'note']
  const stepLabels = {
    name: '步驟',
    command: '指令',
    output: '產出',
    note: '注意事項',
  }

  const fileColumns = ['filename', 'exists', 'size_bytes', 'path']
  const fileLabels = {
    filename: '檔案',
    exists: '是否存在',
    size_bytes: '大小 bytes',
    path: '路徑',
  }

  async function load() {
    const concernRes = await apiClient
      .get('/aips/model-optimization/concerns')
      .catch(showError)

    const workflowRes = await apiClient
      .get('/aips/model-optimization/workflow')
      .catch(showError)

    setConcerns(concernRes?.data || null)
    setWorkflow(workflowRes?.data || null)
  }

  useEffect(() => {
    load()
  }, [])

  const stepRows = (workflow?.steps || []).map((step) => ({
    ...step,
    output: Array.isArray(step.output) ? step.output.join('、') : step.output,
  }))

  return (
    <div className="page">
      <PageHeader
        title="模型優化 / 部署"
        subtitle="將資料品質、特徵工程、調參、剪枝、量化、ONNX、TensorRT 的 concern 與操作流程放進專案，Demo 時可直接展示。"
      >
        <button onClick={load}>重新整理</button>
      </PageHeader>

      {concerns && (
        <div className="card">
          <h2>正式導入產線前 Concern</h2>
          <p>{concerns.safe_demo_statement}</p>
          <DataTable
            columns={concernColumns}
            rows={concerns.risks_if_skip || []}
            labels={concernLabels}
            pageable={false}
          />
        </div>
      )}

      {workflow && (
        <>
          <div className="card">
            <h2>模型優化流程</h2>
            <DataTable
              columns={stepColumns}
              rows={stepRows}
              labels={stepLabels}
              pageable={false}
            />
          </div>

          <div className="card">
            <h2>模型與部署檔案</h2>
            <DataTable
              columns={fileColumns}
              rows={workflow.model_files || []}
              labels={fileLabels}
            />
          </div>

          <div className="card">
            <h2>建議執行順序</h2>
            <pre className="code-block">
{`python tools\\model_optimization\\prune_models.py
python tools\\model_optimization\\export_quant_onnx.py
python tools\\model_optimization\\test_onnx_runtime.py

trtexec --onnx=models\\dqn_scheduler_policy.onnx --saveEngine=models\\dqn_scheduler_policy.engine --fp16`}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}
