import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const serviceHistoryPdf = {
  generatePdf(vehicle, maintenanceEntries, t) {
    if (!vehicle || !maintenanceEntries || maintenanceEntries.length === 0) {
      return false;
    }

    const doc = new jsPDF();
    const currentDate = format(new Date(), 'MMM d, yyyy');

    // Title
    doc.setFontSize(20);
    doc.text(t('maintenance_history') || 'Maintenance History', 14, 22);

    // Vehicle & Date Info
    doc.setFontSize(12);
    doc.text(`${t('vehicle') || 'Vehicle'}: ${vehicle.name}`, 14, 32);
    doc.text(`${t('date') || 'Date'}: ${currentDate}`, 14, 40);

    // Table Data
    const tableColumn = [
      t('date') || "Date", 
      t('odometer') || "Odometer", 
      t('service_type') || "Service Type", 
      t('notes') || "Notes"
    ];
    
    const tableRows = maintenanceEntries.map(entry => {
      const entryDate = format(new Date(entry.timestamp), 'MMM d, yyyy');
      const odo = `${entry.performedAtODO.toLocaleString()} km`;
      const type = t(entry.type) || entry.type;
      const notes = entry.notes || '-';
      
      return [entryDate, odo, type, notes];
    });

    // Generate Table
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 48,
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129] }, // Emerald 500
    });

    // Save PDF
    const filename = `Maintenance_History_${vehicle.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
    doc.save(filename);
    return true;
  }
};
