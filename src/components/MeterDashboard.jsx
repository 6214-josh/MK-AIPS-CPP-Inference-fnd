import React, { useEffect, useMemo, useState } from 'react'
import apiClient from '../api/apiClient'
import DataTable from './DataTable.jsx'
import { PageHeader } from './SimplePanels.jsx'

const CNC_OPTIONS = ['ALL', ...Array.from({ length: 14 }, (_, i) => `CNC-${String(i + 1).padStart(2, '0')}`)]

export default function MeterDashboard() {
  const [selectedCnc, setSelectedCnc] = useState('ALL')
  const [simulateCnc, setSimulateCnc] = useState('CNC-01')
  const [current, setCurrent] = useState({})
  const [rows, setRows] = useState([])
  const [features, setFeatures] = useState([])
  const [dateTimeString, setDateTimeString] = useState('')
  const data = current.currentData || {}

  const linkColumns=['cnc_machine_id','meter_id','device_ip','protocol_type','modbus_unit_id','connected_flag','machine_status','power_kw','demand_kw','thd_current','estimated_machine_status']
  const rawColumns=['meter_data_id','collect_time','cnc_machine_id','power_kw','demand_kw','thd_current','power_factor','power_kwh','device_ip']
  const featureColumns=['feature_id','feature_time','cnc_machine_id','avg_power_kw_5min','thd_current_avg','estimated_machine_status','machine_abnormal_power_flag']

  const voltagePercent = Math.min(Number(data.uunbl || 0) / 10 * 100, 100)
  const currentPercent = Math.min(Number(data.lunbl || 0) / 15 * 100, 100)
  const loadPercent = Math.min(Number(data.loadFactor || 0), 100)
  const lastMonthly = (current.monthlyDataList || []).slice(-1)[0]
  const voltageStatus = Number(data.uunbl||0)>=8?'危險':Number(data.uunbl||0)>=5?'異常':Number(data.uunbl||0)>=2?'注意':'正常'
  const currentStatus = Number(data.lunbl||0)>=12?'危險':Number(data.lunbl||0)>=8?'異常':'正常'

  function formatNumber(value, decimals=1){ const n=Number(value||0); return n.toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}) }
  function barHeight(value){ const list=current.monthlyDataList||[];
  const max=Math.max(...list.map(r=>Math.max(Number(r.maxAe||0),Number(r.maxCe||0))),1);
  return Math.max(8,Math.round(Number(value||0)/max*100)) }
  function updateTime(){ setDateTimeString(new Date().toLocaleString('zh-TW',{hour12:false})) }
  async function seedSelected(){
    const target = simulateCnc === 'ALL' ? 'ALL' : simulateCnc
    if (target === 'ALL') {
      await apiClient.post('/meter/electric/demo-all')
    } else {
      await apiClient.post(`/meter/electric/demo/${target}`)
    }
    setSelectedCnc(target)
    await load()
  }
  async function seedAll(){ await apiClient.post('/meter/electric/demo-all'); setSelectedCnc('ALL'); await load() }
  async function load(){ setCurrent((await apiClient.get('/meter/electric/monitor',{params:{cnc_machine_id:selectedCnc}})).data||{});
  setRows((await apiClient.get('/meter/raw/latest')).data||[]);
  setFeatures((await apiClient.get('/meter/features/latest')).data||[]) }

  useEffect(()=>{ load() }, [selectedCnc])
  useEffect(()=>{ updateTime(); const id=setInterval(()=>{ updateTime(); load() },5000); return ()=>clearInterval(id) }, [selectedCnc])

  return <div className="page electric-page">
  <PageHeader title="智慧電表即時監控" subtitle="智慧電表介面串聯 CNC-01 ~ CNC-14、AIPS 特徵與 DQN State，並可檢視 14 台 CNC 智慧電表狀態。">
  <div className="meter-sim-toolbar">
    <select value={simulateCnc} className="select-control" onChange={e=>setSimulateCnc(e.target.value)}>
      {CNC_OPTIONS.map((cnc, index) => <option key={`simulate-cnc-option-${cnc}-${index}`} value={cnc}>{cnc === 'ALL' ? '全部 CNC' : cnc}</option>)}
    </select>
    <button className="primary-btn" onClick={seedSelected}>模擬</button>
  </div>
  <button className="meter-sim-all-btn" onClick={seedAll}>模擬全部 14 台</button>
  <button onClick={load}>重新整理</button>
  </PageHeader>
  <div className="electric-dashboard">
    <div className="electric-top">{[['本月用電度',
    data.monthlyAe,
    ' kWh',
    'blueBlock'],
    ['去年同期用電度',
    data.lastYearMonthlyAe,
    ' kWh',
    'blueBlock color-down'],
    ['本月碳排量',
    data.carbonEmission,
    ' kg',
    'blueBlock'],
    ['去年同期碳排量',
    data.lastYearCarbonEmission,
    ' kg',
    'blueBlock color-down']].map((x, index)=>
  <div className={`electric-card ${x[3]}`} key={`electric-top-${x[0]}-${index}`}>
  <div className="electric-value">{formatNumber(x[1])}{x[2]}
  </div>
  <div className="electric-footnote">{x[0]}
  </div>
  </div>)}
  </div>
  <div className="electric-top">{[['即時用電量',data.p,' kW','greenBlock'],['最大需量',data.pdm,' kW','greenBlock'],['THD 電流',data.thdCurrent,' %',Number(data.thdCurrent||0)>=15?'dangerBlock':''],['功率因數',data.pf,'','']].map((x, index)=>
  <div className={`electric-card ${x[3]}`} key={`electric-mid-${x[0]}-${index}`}>
  <div className="electric-value">{formatNumber(x[1],x[0]==='功率因數'?2:1)}{x[2]}
  </div>
  <div className="electric-footnote">{x[0]}
  </div>
  </div>)}
  </div>
  <div className="gauge-grid">
  <div className="gauge-card">
  <div className="gauge-title">電壓不平衡度</div>
  <div className="linear-gauge">
  <span style={{width:`${voltagePercent}%`}} />
  </div>
  <div className="gauge-meta">{formatNumber(data.uunbl)} %｜{voltageStatus}
  </div>
  </div>
  <div className="gauge-card">
  <div className="gauge-title">電流不平衡度</div>
  <div className="linear-gauge danger">
  <span style={{width:`${currentPercent}%`}} />
  </div>
  <div className="gauge-meta">{formatNumber(data.lunbl)} %｜{currentStatus}
  </div>
  </div>
  <div className="gauge-card">
  <div className="gauge-title">負載率</div>
  <div className="radial-text">{formatNumber(data.loadFactor)}%</div>
  <div className="linear-gauge load">
  <span style={{width:`${loadPercent}%`}} />
  </div>
  <div className="gauge-meta">{data.machineStatus||'-'}
  </div>
  </div>
  </div>
  <div className="chart-card">
  <div className="chart-title">每月用電量 / 最大需量 / 碳排量</div>
  <div className="bar-chart">{(current.monthlyDataList||[]).map((row, index)=>
  <div className="bar-item" key={`month-${row.monthString}-${index}`}>
  <div className="bar-stack">
  <span className="bar-ae" style={{height:`${barHeight(row.maxAe)}%`}}>
  </span>
  <span className="bar-ce" style={{height:`${barHeight(row.maxCe)}%`}}>
  </span>
  </div>
  <div className="bar-label">{row.monthString}
  </div>
  </div>)}
  </div>
  <div className="chart-legend">
  <span>
  <i className="legend-ae">
  </i>最大用電量</span>
  <span>
  <i className="legend-ce">
  </i>最大碳排量</span>
  <span>最大需量：{formatNumber(lastMonthly?.maxPdm)} kW</span>
  </div>
  </div>
  <div className="footer-time">{dateTimeString}
  </div>
  </div>
  <div className="card">
  <h2>CNC 與智慧電表連線</h2>
  <DataTable columns={linkColumns} rows={current.cncLinks||[]}/>
  </div>
  <div className="card">
  <h2>CNC 電表原始資料</h2>
  <DataTable columns={rawColumns} rows={rows}/>
  </div>
  <div className="card">
  <h2>AI 特徵資料</h2>
  <DataTable columns={featureColumns} rows={features}/>
  </div>
  </div>
}
