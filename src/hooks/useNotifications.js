import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function useNotifications() {
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('fueltracker-notifications-enabled', false);
  const [permissionState, setPermissionState] = useState('default');

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        // Send a test notification
        sendNotification('Notifications Enabled', {
          body: 'You will now receive maintenance reminders and alerts.',
          icon: '/icon.png'
        });
        return true;
      } else {
        setNotificationsEnabled(false);
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [setNotificationsEnabled]);

  // Toggle notifications
  const toggleNotifications = useCallback(async () => {
    if (notificationsEnabled) {
      // Disable notifications
      setNotificationsEnabled(false);
      return false;
    } else {
      // Enable notifications - request permission
      return await requestPermission();
    }
  }, [notificationsEnabled, setNotificationsEnabled, requestPermission]);

  // Send a notification
  const sendNotification = useCallback((title, options = {}) => {
    if (!notificationsEnabled || !('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          icon: '/icon.png',
          badge: '/icon.png',
          tag: options.tag || 'fuel-tracker',
          requireInteraction: options.requireInteraction || false,
          ...options
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          if (options.onClick) {
            options.onClick();
          }
        };

        return notification;
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }
  }, [notificationsEnabled]);

  // Check and send maintenance due notifications
  const checkMaintenanceReminders = useCallback((reminders, currentOdometer) => {
    if (!notificationsEnabled || !reminders?.length) return;

    const now = new Date();
    
    reminders.forEach(reminder => {
      // Check date-based reminders
      if (reminder.nextDueDate || reminder.dueDate) {
        const dueDate = new Date(reminder.nextDueDate || reminder.dueDate);
        const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntilDue <= 0) {
          // Overdue
          sendNotification(`🔧 ${reminder.title} Overdue`, {
            body: `${reminder.title} was due on ${dueDate.toLocaleDateString()}. Please complete this maintenance task.`,
            tag: `reminder-${reminder.id}-overdue`,
            requireInteraction: true
          });
        } else if (daysUntilDue <= 7) {
          // Due soon
          sendNotification(`⏰ ${reminder.title} Due Soon`, {
            body: `${reminder.title} is due in ${daysUntilDue} days (${dueDate.toLocaleDateString()}).`,
            tag: `reminder-${reminder.id}-soon`
          });
        }
      }

      // Check odometer-based reminders
      if (reminder.odometerThreshold && currentOdometer > 0) {
        const kmUntilDue = reminder.odometerThreshold - currentOdometer;
        
        if (kmUntilDue <= 0) {
          // Overdue by odometer
          sendNotification(`🚗 ${reminder.title} - Mileage Due`, {
            body: `${reminder.title} is overdue. Your odometer (${currentOdometer.toLocaleString()} km) has exceeded the threshold (${reminder.odometerThreshold.toLocaleString()} km).`,
            tag: `reminder-${reminder.id}-mileage-overdue`,
            requireInteraction: true
          });
        } else if (kmUntilDue <= 1000) {
          // Due soon by odometer
          sendNotification(`📍 ${reminder.title} - Mileage Approaching`, {
            body: `${reminder.title} is approaching. Only ${kmUntilDue.toLocaleString()} km remaining (threshold: ${reminder.odometerThreshold.toLocaleString()} km).`,
            tag: `reminder-${reminder.id}-mileage-soon`
          });
        }
      }
    });
  }, [notificationsEnabled, sendNotification]);

  // Check for notifications triggered by odometer changes (e.g., after fill-up)
  const checkOdometerThresholds = useCallback((reminders, newOdometer, previousOdometer) => {
    if (!notificationsEnabled || !reminders?.length) return;

    reminders.forEach(reminder => {
      if (!reminder.odometerThreshold) return;

      const threshold = reminder.odometerThreshold;
      
      // Check if we crossed into warning zone (within 1000km of threshold)
      const wasBeforeWarning = previousOdometer < (threshold - 1000);
      const isInWarning = newOdometer >= (threshold - 1000) && newOdometer < threshold;
      
      // Check if we crossed into critical zone (at or past threshold)
      const wasBeforeCritical = previousOdometer < threshold;
      const isAtCritical = newOdometer >= threshold;

      if (wasBeforeWarning && isInWarning) {
        // Entered warning zone
        sendNotification(`⚠️ ${reminder.title} - Warning Zone`, {
          body: `You're approaching the ${reminder.title} milestone. Current: ${newOdometer.toLocaleString()} km, Target: ${threshold.toLocaleString()} km`,
          tag: `reminder-${reminder.id}-warning`,
          requireInteraction: true
        });
      } else if (wasBeforeCritical && isAtCritical) {
        // Entered critical zone
        sendNotification(`🚨 ${reminder.title} - THRESHOLD REACHED`, {
          body: `Your odometer (${newOdometer.toLocaleString()} km) has reached the ${reminder.title} threshold (${threshold.toLocaleString()} km). Schedule maintenance now!`,
          tag: `reminder-${reminder.id}-critical`,
          requireInteraction: true
        });
      }
    });
  }, [notificationsEnabled, sendNotification]);

  return {
    notificationsEnabled,
    permissionState,
    toggleNotifications,
    requestPermission,
    sendNotification,
    checkMaintenanceReminders,
    checkOdometerThresholds
  };
}
