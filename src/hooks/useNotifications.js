import { useState, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function useNotifications() {
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('fueltracker-notifications-enabled', false);
  const [permissionState, setPermissionState] = useState(() => (
    'Notification' in window ? Notification.permission : 'default'
  ));

  // Send a notification
  const sendNotification = useCallback((title, options = {}) => {
    const { force = false, ...notificationOptions } = options;

    if ((!notificationsEnabled && !force) || !('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          icon: '/icon.png',
          badge: '/icon.png',
          tag: notificationOptions.tag || 'fuel-tracker',
          requireInteraction: notificationOptions.requireInteraction || false,
          ...notificationOptions
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          if (notificationOptions.onClick) {
            notificationOptions.onClick();
          }
        };

        return notification;
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }
  }, [notificationsEnabled]);

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
          icon: '/icon.png',
          force: true
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
  }, [sendNotification, setNotificationsEnabled]);

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

  // Check and send maintenance due notifications
  const checkMaintenanceReminders = useCallback((entries, currentOdometer) => {
    if (!notificationsEnabled || !entries?.length) return;

    entries.forEach(entry => {
      if (entry.nextDueODO && currentOdometer > 0) {
        const kmUntilDue = entry.nextDueODO - currentOdometer;
        
        if (kmUntilDue <= 0) {
          // Overdue by odometer
          sendNotification(`🚗 ${entry.type} - Overdue`, {
            body: `Your ${entry.type} maintenance is overdue. Odometer: ${currentOdometer.toLocaleString()} km, Due at: ${entry.nextDueODO.toLocaleString()} km.`,
            tag: `entry-${entry.id}-overdue`,
            requireInteraction: true
          });
        } else if (currentOdometer >= entry.alertODO) {
          // Due soon by alert threshold
          sendNotification(`📍 ${entry.type} - Due Soon`, {
            body: `${entry.type} is due soon. Only ${kmUntilDue.toLocaleString()} km remaining.`,
            tag: `entry-${entry.id}-soon`
          });
        }
      }
    });
  }, [notificationsEnabled, sendNotification]);

  // Check for notifications triggered by odometer changes (e.g., after fill-up)
  const checkOdometerThresholds = useCallback((entries, newOdometer, previousOdometer) => {
    if (!notificationsEnabled || !entries?.length) return;

    entries.forEach(entry => {
      if (!entry.nextDueODO || !entry.alertODO) return;

      const threshold = entry.nextDueODO;
      const alertThreshold = entry.alertODO;
      
      // Check if we crossed into critical zone (at or past threshold)
      const wasBeforeCritical = previousOdometer < threshold;
      const isAtCritical = newOdometer >= threshold;

      // Check if we crossed into warning zone
      const wasBeforeWarning = previousOdometer < alertThreshold;
      const isInWarning = newOdometer >= alertThreshold && newOdometer < threshold;

      if (wasBeforeCritical && isAtCritical) {
        // Entered critical zone
        sendNotification(`🚨 ${entry.type} - THRESHOLD REACHED`, {
          body: `Your odometer (${newOdometer.toLocaleString()} km) has reached the ${entry.type} threshold (${threshold.toLocaleString()} km). Schedule maintenance now!`,
          tag: `entry-${entry.id}-critical`,
          requireInteraction: true
        });
      } else if (wasBeforeWarning && isInWarning) {
        // Entered warning zone
        sendNotification(`⚠️ ${entry.type} - Warning Zone`, {
          body: `You're approaching the ${entry.type} milestone. Current: ${newOdometer.toLocaleString()} km, Target: ${threshold.toLocaleString()} km`,
          tag: `entry-${entry.id}-warning`,
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
