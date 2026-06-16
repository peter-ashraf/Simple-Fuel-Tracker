import { format } from 'date-fns';

export const serviceHistoryPdf = {
  async generatePdf(vehicle, maintenanceEntries, t) {
    if (!vehicle || !maintenanceEntries || maintenanceEntries.length === 0) {
      return false;
    }

    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

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
      t('distance') || "Interval",
      t('next_due') || "Next Due",
      t('price') || "Cost",
      t('notes') || "Notes"
    ];
    
    const tableRows = maintenanceEntries.map(entry => {
      let metadata = {};
      if (entry.description && typeof entry.description === 'string') {
        try {
          const parsed = JSON.parse(entry.description);
          metadata = parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
          metadata = {};
        }
      }
      const entryDate = format(new Date(entry.date || entry.timestamp || entry.createdAt), 'MMM d, yyyy');
      const odometer = Number(entry.performedAtODO ?? entry.odometer ?? 0);
      const interval = Number(entry.intervalKm ?? entry.distance ?? metadata.distance ?? 0);
      const nextDue = Number(entry.nextDueODO ?? entry.nextDueOdometer ?? entry.next_due_odometer ?? 0);
      const cost = entry.cost !== undefined && entry.cost !== null ? Number(entry.cost) : null;
      const odo = odometer ? `${odometer.toLocaleString()} km` : '-';
      const type = t(entry.type) || entry.type;
      const notes = entry.notes || metadata.notes || '-';
      
      return [
        entryDate,
        odo,
        type,
        interval ? `${interval.toLocaleString()} km` : '-',
        nextDue ? `${nextDue.toLocaleString()} km` : '-',
        cost !== null && !Number.isNaN(cost) ? `${cost.toFixed(2)}` : '-',
        notes
      ];
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
