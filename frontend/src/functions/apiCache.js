/**
 * Simple in-memory cache for API responses to reduce redundant requests
 * Helps improve performance by avoiding unnecessary API calls
 */
class ApiCache {
  constructor() {
    this.cache = new Map();
    this.timeouts = new Map();
  }

  /**
   * Set a value in the cache with optional TTL (time to live)
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   */
  set(key, value, ttl = 300000) {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });

    // Clear any existing timeout for this key
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
    }

    // Set new timeout to clear the cache entry
    const timeout = setTimeout(() => {
      this.cache.delete(key);
      this.timeouts.delete(key);
    }, ttl);

    this.timeouts.set(key, timeout);
  }

  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    return entry.value;
  }

  /**
   * Check if a key exists in the cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Remove a specific key from the cache
   * @param {string} key - Cache key
   */
  delete(key) {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
    }
    this.cache.delete(key);
  }

  /**
   * Clear all cached data
   */
  clear() {
    // Clear all timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }

    this.cache.clear();
    this.timeouts.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Wrapper for fetch requests with caching
   * @param {string} url - Request URL
   * @param {object} options - Fetch options
   * @param {number} cacheTtl - Cache TTL in milliseconds
   * @returns {Promise} Fetch promise
   */
  async cachedFetch(url, options = {}, cacheTtl = 300000) {
    const cacheKey = `${url}_${JSON.stringify(options)}`;

    // Return cached response if available
    if (this.has(cacheKey)) {
      return Promise.resolve(this.get(cacheKey));
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      // Only cache successful responses
      if (response.ok) {
        this.set(cacheKey, { response, data }, cacheTtl);
        return { response, data };
      }

      return { response, data };
    } catch (error) {
      console.error("Cached fetch error:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiCache = new ApiCache();

// Export class for custom instances if needed
export default ApiCache;
