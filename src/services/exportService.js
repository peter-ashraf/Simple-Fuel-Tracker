// Export Service - Handle Excel and PDF exports
// Uses xlsx for Excel and jspdf-autotable for PDF generation

import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { autoTable } from 'jspdf-autotable'

/**
 * Export data to Excel format
 * @param {Object} data - Data to export
 * @param {string} filename - Filename for the export
 * @returns {Promise<Blob>} Excel file as blob
 */
export async function exportToExcel(data, filename = 'fuel-data-export') {
  try {
    // Format data for Excel
    const formattedData = formatDataForExport(data, 'excel')
    
    // Create workbook
    const wb = XLSX.utils.book_new()
    
    // Add sheets based on data structure
    if (formattedData.fillUps && formattedData.fillUps.length > 0) {
      const ws = XLSX.utils.json_to_sheet(formattedData.fillUps)
      XLSX.utils.book_append_sheet(wb, ws, 'Fill-ups')
    }
    
    if (formattedData.maintenance && formattedData.maintenance.length > 0) {
      const ws = XLSX.utils.json_to_sheet(formattedData.maintenance)
      XLSX.utils.book_append_sheet(wb, ws, 'Maintenance')
    }
    
    if (formattedData.summary) {
      const summaryData = Object.entries(formattedData.summary).map(([key, value]) => ({
        Metric: key,
        Value: value,
      }))
      const ws = XLSX.utils.json_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, ws, 'Summary')
    }
    
    // Generate buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    
    // Create blob
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    
    return blob
  } catch (error) {
    console.error('[ExportService] Excel export error:', error)
    throw new Error('Failed to export to Excel')
  }
}

/**
 * Export data to PDF format
 * @param {Object} data - Data to export
 * @param {string} filename - Filename for the export
 * @returns {Promise<Blob>} PDF file as blob
 */
export async function exportToPDF(data, filename = 'fuel-data-export') {
  try {
    const formattedData = formatDataForExport(data, 'pdf')
    
    // Create PDF document
    const doc = new jsPDF()
    
    // Add title
    doc.setFontSize(18)
    doc.text('Fuel Data Report', 14, 22)
    
    let yPos = 35
    
    // Add summary if available
    if (formattedData.summary) {
      doc.setFontSize(14)
      doc.text('Summary', 14, yPos)
      yPos += 10
      
      doc.setFontSize(10)
      Object.entries(formattedData.summary).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`, 14, yPos)
        yPos += 7
      })
      yPos += 10
    }
    
    // Add fill-ups table if available
    if (formattedData.fillUps && formattedData.fillUps.length > 0) {
      doc.setFontSize(14)
      doc.text('Fill-ups', 14, yPos)
      yPos += 7
      
      const fillUpColumns = Object.keys(formattedData.fillUps[0])
      const fillUpRows = formattedData.fillUps.map(row => Object.values(row))
      
      autoTable(doc, {
        startY: yPos,
        head: [fillUpColumns],
        body: fillUpRows,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
      })
      
      yPos = doc.lastAutoTable.finalY + 15
    }
    
    // Add maintenance table if available
    if (formattedData.maintenance && formattedData.maintenance.length > 0) {
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }
      
      doc.setFontSize(14)
      doc.text('Maintenance', 14, yPos)
      yPos += 7
      
      const maintenanceColumns = Object.keys(formattedData.maintenance[0])
      const maintenanceRows = formattedData.maintenance.map(row => Object.values(row))
      
      autoTable(doc, {
        startY: yPos,
        head: [maintenanceColumns],
        body: maintenanceRows,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
      })
    }
    
    // Generate blob
    const pdfBlob = doc.output('blob')
    
    return pdfBlob
  } catch (error) {
    console.error('[ExportService] PDF export error:', error)
    throw new Error('Failed to export to PDF')
  }
}

/**
 * Format data for export based on format type
 * @param {Object} data - Raw data
 * @param {string} format - 'excel' or 'pdf'
 * @returns {Object} Formatted data
 */
function formatDataForExport(data, format) {
  const formatted = {
    fillUps: [],
    maintenance: [],
    summary: {},
  }
  
  // Handle different data structures from query executor
  const queryData = data.data || data
  
  // Process fill-ups
  if (queryData.fillUps) {
    formatted.fillUps = queryData.fillUps.map(f => ({
      Date: new Date(f.date || f.timestamp).toLocaleDateString(),
      Odometer: f.odometer,
      Liters: f.liters,
      'Price per Liter': f.pricePerLiter,
      'Total Cost': f.totalCost,
    }))
  }
  
  // Process maintenance
  if (queryData.maintenance) {
    formatted.maintenance = queryData.maintenance.map(m => ({
      Date: new Date(m.date || m.timestamp).toLocaleDateString(),
      Type: m.type,
      Odometer: m.odometer,
      Cost: m.cost,
    }))
  }
  
  // Process summary
  if (queryData.summary) {
    formatted.summary = {
      'Fill-up Count': queryData.summary.fillUpCount || 0,
      'Maintenance Count': queryData.summary.maintenanceCount || 0,
      'Date Range': queryData.summary.dateRange || 'All time',
    }
  }
  
  // Add additional summary data if available
  if (queryData.totalCost !== undefined) {
    formatted.summary['Total Cost'] = queryData.totalCost.toFixed(2)
  }
  if (queryData.totalDistance !== undefined) {
    formatted.summary['Total Distance'] = queryData.totalDistance.toLocaleString() + ' km'
  }
  if (queryData.avgEfficiency !== undefined) {
    formatted.summary['Average Efficiency'] = queryData.avgEfficiency.toFixed(2) + ' km/L'
  }
  if (queryData.fillUpCount !== undefined) {
    formatted.summary['Fill-up Count'] = queryData.fillUpCount
  }
  if (queryData.totalLiters !== undefined) {
    formatted.summary['Total Liters'] = queryData.totalLiters.toFixed(2)
  }
  if (queryData.avgCostPerFill !== undefined) {
    formatted.summary['Average Cost per Fill'] = queryData.avgCostPerFill.toFixed(2)
  }
  
  return formatted
}

/**
 * Generate a custom report
 * @param {Object} data - Data to include in report
 * @param {string} type - Report type
 * @returns {Promise<Blob>} Report as blob (PDF)
 */
export async function generateReport(data, type = 'general') {
  try {
    const formattedData = formatDataForExport(data, 'pdf')
    
    const doc = new jsPDF()
    
    // Add title based on type
    const titles = {
      general: 'Fuel Data Report',
      cost: 'Fuel Cost Analysis',
      efficiency: 'Efficiency Report',
      maintenance: 'Maintenance Report',
    }
    
    doc.setFontSize(20)
    doc.text(titles[type] || 'Fuel Data Report', 14, 22)
    
    // Add date
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30)
    
    let yPos = 40
    
    // Add summary section
    if (formattedData.summary) {
      doc.setFontSize(14)
      doc.text('Summary', 14, yPos)
      yPos += 10
      
      doc.setFontSize(10)
      Object.entries(formattedData.summary).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`, 14, yPos)
        yPos += 7
      })
      yPos += 10
    }
    
    // Add data tables based on type
    if (type === 'cost' && formattedData.fillUps.length > 0) {
      doc.setFontSize(14)
      doc.text('Cost Breakdown', 14, yPos)
      yPos += 7
      
      const costData = formattedData.fillUps.map(f => ({
        Date: f.Date,
        Cost: f['Total Cost'],
        'Price/L': f['Price per Liter'],
      }))
      
      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Cost', 'Price/L']],
        body: costData.map(row => [row.Date, row.Cost, row['Price/L']]),
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
      })
    }
    
    if (type === 'maintenance' && formattedData.maintenance.length > 0) {
      doc.setFontSize(14)
      doc.text('Maintenance Records', 14, yPos)
      yPos += 7
      
      const maintenanceColumns = Object.keys(formattedData.maintenance[0])
      const maintenanceRows = formattedData.maintenance.map(row => Object.values(row))
      
      autoTable(doc, {
        startY: yPos,
        head: [maintenanceColumns],
        body: maintenanceRows,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
      })
    }
    
    const pdfBlob = doc.output('blob')
    return pdfBlob
  } catch (error) {
    console.error('[ExportService] Report generation error:', error)
    throw new Error('Failed to generate report')
  }
}

/**
 * Download a blob as a file
 * @param {Blob} blob - Data blob
 * @param {string} filename - Filename
 * @param {string} extension - File extension
 */
export function downloadBlob(blob, filename, extension) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.${extension}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
