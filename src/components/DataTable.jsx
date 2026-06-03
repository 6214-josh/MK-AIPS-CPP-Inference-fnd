import React, { useEffect, useMemo, useState } from 'react'

function norm(column, label) {
  return `${column || ''} ${label || ''}`.toLowerCase()
}

function isIdOrCode(column, label) {
  const text = norm(column, label)
  return (
    text.endsWith('_id') ||
    text.includes(' id') ||
    text.includes('id ') ||
    text.includes('no') ||
    text.includes('code') ||
    text.includes('編號') ||
    text.includes('製令') ||
    text.includes('料號')
  )
}

function shouldFormatAsInteger(column, label) {
  const text = norm(column, label)

  // FIX49：
  // 只有「量」類欄位才整數化。
  // 避免 kWh、分鐘、分數、時間、風險被誤判。
  if (text.includes('kwh') || text.includes('minute') || text.includes('分鐘') || text.includes('score') || text.includes('分數')) {
    return false
  }

  return (
    text.includes('qty') ||
    text.includes('quantity') ||
    text.includes('count') ||
    text.includes('數量') ||
    text.includes('產量') ||
    text.includes('良品量') ||
    text.includes('不良量') ||
    text.includes('預測量') ||
    text.includes('筆數') ||
    /(^|[\s_])量($|[\s_])/.test(text) ||
    (label || '').includes('量')
  )
}

function shouldFormatAsPercent(column, label) {
  const text = norm(column, label)
  const zh = label || ''

  // FIX49：
  // 只有「率」或 OEE 才轉百分比。
  // 不再把「信心分數」「風險」轉成百分比，這些維持小數點 3 位。
  return (
    zh.includes('率') ||
    text.includes('rate') ||
    text.includes('ratio') ||
    text.includes('yield') ||
    text.includes('oee')
  )
}

function toNumberIfNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed)
      return Number.isFinite(n) ? n : null
    }
  }
  return null
}

function roundTo(n, digits) {
  const base = Math.pow(10, digits)
  return Math.round(n * base) / base
}

function formatValue(value, column, label) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (isIdOrCode(column, label)) return String(value)

  const n = toNumberIfNumeric(value)
  if (n !== null) {
    // 量：整數
    if (shouldFormatAsInteger(column, label)) {
      return String(Math.round(n))
    }

    // 率/OEE：乘 100 + %，小數 1 位
    if (shouldFormatAsPercent(column, label)) {
      const percent = n <= 1.5 ? n * 100 : n
      return `${roundTo(percent, 1).toFixed(1)}%`
    }

    // 其他所有小數：最多小數點 3 位
    return String(roundTo(n, 3))
  }

  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function normalizeText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value).toLowerCase()
  return String(value).toLowerCase()
}

export default function DataTable({
  columns = [],
  rows = [],
  labels = {},
  renderActions,
  searchable = true,
  pageable = true,
  defaultPageSize = 10,
  searchPlaceholder = '搜尋目前表格...'
}) {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = defaultPageSize || 10

  const filteredRows = useMemo(() => {
    const sourceRows = rows || []
    const key = keyword.trim().toLowerCase()
    if (!key) return sourceRows
    return sourceRows.filter(row => {
      return columns.some(col => normalizeText(row?.[col]).includes(key))
        || normalizeText(row).includes(key)
    })
  }, [rows, columns, keyword])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))

  const pageRows = useMemo(() => {
    if (!pageable) return filteredRows
    const safePage = Math.min(Math.max(page, 1), totalPages)
    const start = (safePage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize, pageable, totalPages])

  useEffect(() => { setPage(1) }, [keyword, rows])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const safePage = Math.min(page, totalPages)
  const startNo = filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endNo = pageable ? Math.min(startNo + pageRows.length - 1, filteredRows.length) : filteredRows.length

  return (
    <div className="data-table-panel">
      {searchable && (
        <div className="table-toolbar no-page-size">
          <div className="table-search-wrap">
            <input
              className="table-search-input"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map(col => <th key={col}>{labels[col] || col}</th>)}
              {renderActions && <th>操作</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={columns.length + (renderActions ? 1 : 0)}>目前沒有資料</td></tr>
            ) : pageRows.map((row, idx) => (
              <tr key={row.id || row[columns[0]] || `${idx}-${page}`}>
                {columns.map(col => <td key={col}>{formatValue(row[col], col, labels[col])}</td>)}
                {renderActions && <td>{renderActions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageable && (
        <div className="table-pagination">
          <div className="table-page-info">
            顯示 {startNo} - {endNo} 筆，共 {filteredRows.length} 筆
            {keyword && <span>，原始 {rows.length} 筆</span>}
          </div>

          <div className="table-page-buttons">
            <button disabled={page <= 1} onClick={() => setPage(1)}>第一頁</button>
            <button disabled={page <= 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>上一頁</button>
            <span className="page-current">{safePage} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}>下一頁</button>
            <button disabled={page >= totalPages} onClick={() => setPage(totalPages)}>最後頁</button>
          </div>
        </div>
      )}
    </div>
  )
}
