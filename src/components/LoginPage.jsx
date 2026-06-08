import React, { useState } from 'react'
import minkingLogo from '../assets/minking-logo-brand.png'
import iksLogo from '../assets/iks-logo.png'
import apiClient from '../api/apiClient'

export default function LoginPage({ onLoginSuccess }) {
  const [form, setForm] = useState({ username: 'admin', password: '123456' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })) }
  function fillAdmin() { setForm({ username: 'admin', password: '123456' }) }

  async function login() {
    setLoading(true); setMessage(''); setSuccess(false)
    try {
      // FIX65：
      // 登入不能被 /hardware-simulator/init 卡住。
      // 原本會先 await init，若資料表初始化較久或 DB lock，畫面會一直停在「登入中...」。
      // 現在先登入；登入成功後再背景初始化 Demo schema。
      const res = await apiClient.post('/auth/login', form)
      if (!res.data.success) { setMessage(res.data.message || '登入失敗'); return }
      setSuccess(true); setMessage('登入成功')
      onLoginSuccess({ token: res.data.token, user: res.data.user })
      apiClient.post('/hardware-simulator/init').catch(() => {})
    } catch (err) {
      setMessage(err?.response?.data?.detail || err?.response?.data?.message || `${err?.message || '登入 API 發生錯誤'}，目前 API：${apiClient.defaults.baseURL}，請確認後端與防火牆`)
    } finally { setLoading(false) }
  }

  function enter(e) { if (e.key === 'Enter') login() }

  return (
    <div className="login-page">
      <div className="login-card">
        <img className="login-logo-image" src={minkingLogo} alt="MinKing Logo" />
        <div className="login-si-card">
          <img className="login-si-logo" src={iksLogo} alt="國興資訊 國興資訊 IKS Logo" />
          <span className="si-company">國興資訊</span>
        </div>
        <h1>MK-AIPS 智慧排程模組</h1>
        <p>請先登入後再進入系統。</p>
        <div className="login-form">
          <label>帳號<input value={form.username} onKeyUp={enter} onChange={e => update('username', e.target.value)} /></label>
          <label>密碼<input value={form.password} type="password" onKeyUp={enter} onChange={e => update('password', e.target.value)} /></label>
          <button className="primary-btn login-btn" onClick={login} disabled={loading}>{loading ? '登入中...' : '登入'}</button>
          <button className="demo-btn" onClick={fillAdmin}>使用 Demo 帳密 admin / 123456</button>
          {message && <div className={`login-message ${success ? '' : 'error'}`}>{message}</div>}
        </div>
        <div className="login-hint"><strong>Demo 帳密：</strong> admin / 123456、operator01 / 123456、planner01 / 123456</div>
      </div>
    </div>
  )
}
