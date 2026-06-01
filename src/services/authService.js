import { supabase } from '../lib/supabaseClient';

export const authService = {
  /**
   * Sign in with email and password
   * @param {string} email 
   * @param {string} password 
   * @param {boolean} rememberMe 
   * @returns {Promise<Object>} User data or error
   */
  async signIn(email, password, rememberMe = true) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Store remember me preference
    localStorage.setItem('fueltracker-remember-me', rememberMe ? 'true' : 'false');

    return data;
  },

  /**
   * Sign up with email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>} User data or error
   */
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get the current session
   * @returns {Promise<Object|null>} Session or null
   */
  async getSession() {
    console.log('[Auth] getSession start');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[Auth] getSession error:', error);
        return null;
      }
      console.log('[Auth] getSession result:', session ? 'session found' : 'no session');
      return session;
    } catch (error) {
      console.error('[Auth] getSession exception:', error);
      return null;
    }
  },

  /**
   * Get the current user
   * @returns {Promise<Object|null>} User or null
   */
  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  /**
   * Listen to auth state changes
   * @param {Function} callback 
   * @returns {Object} Subscription object
   */
  onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] auth change event:', event, session ? 'session exists' : 'no session');
        callback(event, session);
      }
    );
    return subscription;
  }
};
