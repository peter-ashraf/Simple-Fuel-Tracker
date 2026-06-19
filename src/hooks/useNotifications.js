import { useState, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function useNotifications() {
  const isNotificationSupported = 'Notification' in window;
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('fueltracker-notifications-enabled', false);
  const [permissionState, setPermissionState] = useState(() => (
    isNotificationSupported ? Notification.permission : 'unsupported'
  ));

  const sendNotification = useCallback((title, options = {}) => {
    const { force = false, ...notificationOptions } = options;

    if ((!notificationsEnabled && !force) || !isNotificationSupported) {
      return undefined;
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

    return undefined;
  }, [isNotificationSupported, notificationsEnabled]);

  const requestPermission = useCallback(async () => {
    if (!isNotificationSupported) {
      console.log('This browser does not support notifications');
      setPermissionState('unsupported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission === 'granted') {
        setNotificationsEnabled(true);
        sendNotification('Notifications Enabled', {
          body: 'You will now receive maintenance reminders and alerts.',
          icon: '/icon.png',
          force: true
        });
        return true;
      }

      setNotificationsEnabled(false);
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isNotificationSupported, sendNotification, setNotificationsEnabled]);

  const toggleNotifications = useCallback(async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      return false;
    }

    return await requestPermission();
  }, [notificationsEnabled, setNotificationsEnabled, requestPermission]);

  const checkMaintenanceReminders = useCallback((entries, currentOdometer) => {
    if (!notificationsEnabled || !entries?.length) return;

    entries.forEach((entry) => {
      const nextDueODO = Number(entry.nextDueODO ?? entry.nextDueOdometer ?? entry.next_due_odometer ?? 0);
      const alertODO = Number(entry.alertODO ?? 0);
      const typeLabel = entry.name || entry.type || entry.categoryId || 'Maintenance';
      const kmUntilDue = Number.isFinite(entry.kmUntilDue)
        ? entry.kmUntilDue
        : nextDueODO - currentOdometer;

      if (nextDueODO && currentOdometer > 0) {

        if (entry.status === 'overdue' || kmUntilDue <= 0) {
          sendNotification(`${typeLabel} - Overdue`, {
            body: `Your ${typeLabel} maintenance is overdue. Odometer: ${currentOdometer.toLocaleString()} km, Due at: ${nextDueODO.toLocaleString()} km.`,
            tag: `maintenance-${entry.categoryId || entry.id}-overdue`,
            requireInteraction: true
          });
        } else if (entry.status === 'due-soon' || (alertODO && currentOdometer >= alertODO)) {
          sendNotification(`${typeLabel} - Due Soon`, {
            body: `${typeLabel} is due soon. Only ${kmUntilDue.toLocaleString()} km remaining.`,
            tag: `maintenance-${entry.categoryId || entry.id}-soon`
          });
        }
      }
    });
  }, [notificationsEnabled, sendNotification]);

  const checkOdometerThresholds = useCallback((entries, newOdometer, previousOdometer) => {
    if (!notificationsEnabled || !entries?.length) return;

    entries.forEach((entry) => {
      if (!entry.nextDueODO || !entry.alertODO) return;

      const threshold = entry.nextDueODO;
      const alertThreshold = entry.alertODO;
      const wasBeforeCritical = previousOdometer < threshold;
      const isAtCritical = newOdometer >= threshold;
      const wasBeforeWarning = previousOdometer < alertThreshold;
      const isInWarning = newOdometer >= alertThreshold && newOdometer < threshold;

      if (wasBeforeCritical && isAtCritical) {
        sendNotification(`${entry.type} - THRESHOLD REACHED`, {
          body: `Your odometer (${newOdometer.toLocaleString()} km) has reached the ${entry.type} threshold (${threshold.toLocaleString()} km). Schedule maintenance now!`,
          tag: `entry-${entry.id}-critical`,
          requireInteraction: true
        });
      } else if (wasBeforeWarning && isInWarning) {
        sendNotification(`${entry.type} - Warning Zone`, {
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
    isNotificationSupported,
    toggleNotifications,
    requestPermission,
    sendNotification,
    checkMaintenanceReminders,
    checkOdometerThresholds
  };
}
