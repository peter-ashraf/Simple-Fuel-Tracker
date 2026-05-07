Implementation Plan: Maintenance Overhaul
Overhauling the Maintenance section to move away from cluttered category lists toward an adaptive, priority-driven dashboard that emphasizes vehicle health, upcoming tasks, and predictive service dates.

User Review Required
IMPORTANT

Priority over Completeness: The main dashboard will no longer show every category by default. It will only show categories that are Due Soon or Overdue. Healthy categories will be tucked away in a "Full Schedule" view. Predictive Dates: We will use the user's historical driving data (avg km/day) to predict exact dates for next services. This requires at least two fill-ups to be accurate.

Proposed Changes
[Component]
Maintenance.jsx
The main Maintenance screen will be refactored into three primary sub-views:

1. Adaptive Overview (New Default)
   Vehicle Health Gauge: A premium glassmorphic hero card showing an overall health percentage (based on how many tasks are overdue/due soon).
   "Attention Required" Section: Only displays cards for categories that are Overdue or Due Soon.
   Predictive "Due Date": Displays an estimated calendar date for when the next service is expected (e.g., "Expected in 12 days - Nov 24").
   Minimalist "All Clear" State: If everything is healthy, display a beautiful "Vehicle Healthy" illustration and summary.
2. Service History (Redesigned)
   Timeline View: A clean vertical timeline of all maintenance logs.
   Cost Integration: Displays the cost of each service and a running total for the year.
   Entry Details: Quick access to notes and odometer at the time of service.
3. Maintenance Schedule (Moved Category List)
   This is where the full list of all categories will live.
   Users can browse all tracked items here, even healthy ones.
   Tapping a category allows editing its interval and safety margin.
   [Component]
   useFuelContext.jsx
   [MODIFY] logic to include predictive analytics
   Average Daily Distance: Implement a memoized calculation of average km driven per day based on fill-up history.
   Maintenance Entry Enhancement: Ensure cost is a standard field in the maintenanceEntries schema.
   Health Score Calculation: Add a derived state that calculates the overall car health percentage.
   [Component]
   MaintenanceEntryForm.jsx
   [MODIFY] input fields
   Add Cost Field: Allow users to log the price paid for the service.
   Simplify UI: Ensure the form matches the new premium design language (less borders, better spacing).
   Verification Plan
   Automated Tests
   No automated tests currently exist; verification will be manual.
   Manual Verification
   Adaptive Logic: Verify that only categories with low remaining Km (below safety margin) appear on the overview.
   Predictive Dates: Log a few fill-ups across several days, then check if the Maintenance overview shows a "Predicted Date".
   Timeline: Log a service with a cost and verify it appears correctly in the timeline with its price.
   Configuration: Ensure changing an interval in the "Schedule" tab correctly updates the health status in the "Overview" tab.
