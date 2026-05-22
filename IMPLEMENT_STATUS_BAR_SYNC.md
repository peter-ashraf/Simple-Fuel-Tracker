# Task: Implement iPhone Status Bar Color Syncing for PWA

## Overview
Implement dynamic theme-color meta tag updates to sync the iPhone's status bar color with your PWA's theme (light/dark mode). This ensures the status bar seamlessly matches your app's current visual theme when added to the iPhone home screen.

## Why This Matters
- **User Experience:** Creates a cohesive visual experience where the status bar doesn't clash with your app's theme
- **Professional Polish:** Demonstrates attention to platform-specific details
- **iOS PWA Best Practice:** Apple recommends matching the status bar to your app's theme for native-like feel

## Implementation Steps

### Step 1: Add Static Meta Tags to index.html
Add these meta tags in the `<head>` section of your HTML file:

```html
<!-- iOS PWA status bar configuration -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#fcfcf9">
```

**Explanation:**
- `apple-mobile-web-app-capable`: Enables full-screen mode when added to home screen
- `apple-mobile-web-app-status-bar-style`: Set to "default" to use the theme-color for status bar
- `theme-color`: Initial color (use your light theme background color)

### Step 2: Create Theme Color Update Function
Add a function to dynamically update the theme-color meta tag based on the current theme:

```javascript
const updateThemeColorMeta = useCallback((currentActiveTheme) => {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.getElementsByTagName('head')[0].appendChild(meta);
  }

  // Use your actual theme colors from your CSS
  const color = currentActiveTheme === 'dark' ? '#1f2121' : '#fcfcf9';
  meta.setAttribute('content', color);
}, []);
```

**Important:** Replace the hex colors with your actual theme background colors from your CSS variables.

### Step 3: Integrate with Theme Management
Call the `updateThemeColorMeta` function whenever your theme changes:

```javascript
useEffect(() => {
  const handleThemeChange = () => {
    const newActiveTheme = getActiveTheme(theme);
    setActiveTheme(newActiveTheme);
    document.documentElement.setAttribute('data-theme', newActiveTheme);
    updateThemeColorMeta(newActiveTheme); // Update status bar color
  };

  handleThemeChange();

  // Listen for system theme changes if using "system" theme mode
  if (theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }
}, [theme, getActiveTheme, updateThemeColorMeta]);
```

### Step 4: Determine Your Theme Colors
Find the exact background colors from your CSS:

**For your CSS:**
```css
:root {
  --color-background: #fcfcf9; /* Light theme background */
}

[data-theme="dark"] {
  --color-background: #1f2121; /* Dark theme background */
}
```

Use these exact hex values in your `updateThemeColorMeta` function.

## Complete Implementation Example

Here's a complete example you can adapt to your React context:

```javascript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'system';
  });

  const getActiveTheme = useCallback((baseTheme) => {
    if (baseTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return baseTheme;
  }, []);

  const [activeTheme, setActiveTheme] = useState(() => getActiveTheme(theme));

  // Update theme-color meta tag for PWA and iOS status bar
  const updateThemeColorMeta = useCallback((currentActiveTheme) => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.getElementsByTagName('head')[0].appendChild(meta);
    }

    // REPLACE THESE WITH YOUR ACTUAL THEME COLORS
    const color = currentActiveTheme === 'dark' ? '#1f2121' : '#fcfcf9';
    meta.setAttribute('content', color);
  }, []);

  // Handle theme changes
  useEffect(() => {
    localStorage.setItem('theme', theme);

    const handleThemeChange = () => {
      const newActiveTheme = getActiveTheme(theme);
      setActiveTheme(newActiveTheme);
      document.documentElement.setAttribute('data-theme', newActiveTheme);
      updateThemeColorMeta(newActiveTheme);
    };

    handleThemeChange();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', handleThemeChange);
      return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }
  }, [theme, getActiveTheme, updateThemeColorMeta]);

  const contextValue = {
    theme,
    setTheme,
    activeTheme
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
```

## Testing Checklist

- [ ] Add meta tags to index.html
- [ ] Implement updateThemeColorMeta function
- [ ] Integrate with theme change logic
- [ ] Test light mode: Status bar should match light background
- [ ] Test dark mode: Status bar should match dark background
- [ ] Test system mode: Status bar should update when OS theme changes
- [ ] Test on iPhone: Add app to home screen and verify status bar color
- [ ] Test theme switching while app is open: Status bar should update immediately

## Platform-Specific Notes

### iOS
- The `apple-mobile-web-app-status-bar-style` meta tag must be set to "default"
- Other options are "black" or "black-translucent", but these don't sync with theme-color
- Theme changes only take effect when the app is relaunched or when dynamically updated via JavaScript

### Android
- Android automatically uses the `theme-color` meta tag for the browser chrome
- No additional meta tags needed
- Dynamic updates work immediately

### Desktop Browsers
- Chrome, Edge, and Firefox use `theme-color` for the browser address bar
- Safari on macOS also respects this meta tag

## Common Issues & Solutions

**Issue:** Status bar color doesn't update on theme change
- **Solution:** Ensure `updateThemeColorMeta` is called in your theme change useEffect

**Issue:** Meta tag not found on initial load
- **Solution:** The function creates the meta tag if it doesn't exist, but ensure the static meta tag is in index.html as a fallback

**Issue:** Wrong colors displayed
- **Solution:** Verify the hex colors in `updateThemeColorMeta` match your actual CSS background colors exactly

**Issue:** iOS status bar always black
- **Solution:** Ensure `apple-mobile-web-app-status-bar-style` is set to "default", not "black"

## Additional Enhancements

**Support for custom themes:**
If your app supports more than light/dark themes, extend the function:

```javascript
const updateThemeColorMeta = useCallback((currentActiveTheme) => {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.getElementsByTagName('head')[0].appendChild(meta);
  }

  const themeColors = {
    light: '#fcfcf9',
    dark: '#1f2121',
    blue: '#e3f2fd',
    green: '#e8f5e9'
  };

  const color = themeColors[currentActiveTheme] || themeColors.light;
  meta.setAttribute('content', color);
}, []);
```

## References
- [Apple Web App Meta Tags](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [MDN: theme-color](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name/theme-color)
- [PWA Best Practices](https://web.dev/add-manifest/)
