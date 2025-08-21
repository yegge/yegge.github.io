// airtable.js - Complete Airtable Integration
// Place this file in /assets/js/airtable.js

class AirtableAPI {
    constructor(apiKey, baseId) {
        this.apiKey = apiKey;
        this.baseId = baseId;
        this.baseUrl = `https://api.airtable.com/v0/${baseId}`;
        this.headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    // Generic method to fetch data from any table
    async fetchRecords(tableName, options = {}) {
        try {
            let url = `${this.baseUrl}/${encodeURIComponent(tableName)}`;
            const params = new URLSearchParams();

            // Add query parameters
            if (options.filterByFormula) {
                params.append('filterByFormula', options.filterByFormula);
            }
            
            if (options.sort) {
                options.sort.forEach((sortField, index) => {
                    params.append(`sort[${index}][field]`, sortField.field);
                    params.append(`sort[${index}][direction]`, sortField.direction || 'asc');
                });
            }
            
            if (options.maxRecords) {
                params.append('maxRecords', options.maxRecords);
            }
            
            if (options.pageSize) {
                params.append('pageSize', options.pageSize);
            }
            
            if (options.offset) {
                params.append('offset', options.offset);
            }

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            console.log('Fetching from:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching ${tableName}:`, error);
            throw error;
        }
    }

    // Create a new record
    async createRecord(tableName, fields) {
        try {
            const response = await fetch(`${this.baseUrl}/${encodeURIComponent(tableName)}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({ fields })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error creating record in ${tableName}:`, error);
            throw error;
        }
    }

    // Update a record
    async updateRecord(tableName, recordId, fields) {
        try {
            const response = await fetch(`${this.baseUrl}/${encodeURIComponent(tableName)}/${recordId}`, {
                method: 'PATCH',
                headers: this.headers,
                body: JSON.stringify({ fields })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error updating record in ${tableName}:`, error);
            throw error;
        }
    }

    // Delete a record
    async deleteRecord(tableName, recordId) {
        try {
            const response = await fetch(`${this.baseUrl}/${encodeURIComponent(tableName)}/${recordId}`, {
                method: 'DELETE',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error deleting record in ${tableName}:`, error);
            throw error;
        }
    }

    // SPECIFIC METHODS FOR YOUR TABLES

    // Albums
    async getAlbums(filters = {}) {
        const options = {
            sort: [{ field: 'Release Date', direction: 'desc' }]
        };

        // Build filter formula
        const filterParts = [];
        
        if (filters.artist) {
            filterParts.push(`{Album Artist} = "${filters.artist}"`);
        }
        
        if (filters.status) {
            filterParts.push(`{Album Status} = "${filters.status}"`);
        }
        
        if (filters.visibility) {
            filterParts.push(`{Visibility} = "${filters.visibility}"`);
        } else {
            // Default to public only if no visibility specified
            filterParts.push(`{Visibility} = "PUBLIC"`);
        }

        if (filterParts.length > 0) {
            options.filterByFormula = `AND(${filterParts.join(', ')})`;
        }

        return await this.fetchRecords('Albums', options);
    }

    async getAlbumById(albumId) {
        try {
            const response = await fetch(`${this.baseUrl}/Albums/${albumId}`, {
                headers: this.headers
            });
            return await response.json();
        } catch (error) {
            console.error('Error fetching album:', error);
            throw error;
        }
    }

    // Tracks
    async getTracks(albumId = null) {
        const options = {
            sort: [{ field: 'Track No.', direction: 'asc' }]
        };

        if (albumId) {
            options.filterByFormula = `{Album ID} = "${albumId}"`;
        }

        return await this.fetchRecords('Tracks', options);
    }

    async getTracksByAlbum(albumId) {
        return await this.getTracks(albumId);
    }

    // Blog Posts
    async getBlogPosts(filters = {}) {
        const options = {
            sort: [{ field: 'Publish Date', direction: 'desc' }]
        };

        const filterParts = [];
        
        // Only show published posts by default
        if (filters.includeStatus !== 'all') {
            filterParts.push(`{Status} = "Published"`);
        }
        
        if (filters.category && filters.category !== 'all') {
            filterParts.push(`{Category} = "${filters.category}"`);
        }
        
        // Only show posts with publish date in the past
        filterParts.push(`{Publish Date} <= TODAY()`);

        if (filterParts.length > 0) {
            options.filterByFormula = `AND(${filterParts.join(', ')})`;
        }

        return await this.fetchRecords('Blog Posts', options);
    }

    async getBlogPostBySlug(slug) {
        const options = {
            filterByFormula: `{Slug} = "${slug}"`
        };

        const response = await this.fetchRecords('Blog Posts', options);
        return response.records && response.records.length > 0 ? response.records[0] : null;
    }

    // Subscribers
    async getSubscribers(filters = {}) {
        const options = {
            sort: [{ field: 'Signup Date', direction: 'desc' }]
        };

        if (filters.status) {
            options.filterByFormula = `{Status} = "${filters.status}"`;
        }

        return await this.fetchRecords('Subscribers', options);
    }

    async addSubscriber(subscriberData) {
        const fields = {
            'First Name': subscriberData.firstName,
            'Last Name': subscriberData.lastName,
            'Email': subscriberData.email,
            'Phone': subscriberData.phone || '',
            'Country': subscriberData.country,
            'Subscribe Updates': subscriberData.subscribe !== false,
            'Status': 'Active',
            'Source': 'Website'
        };

        return await this.createRecord('Subscribers', fields);
    }

    // Contact Inquiries
    async getInquiries(filters = {}) {
        const options = {
            sort: [{ field: 'Inquiry Date', direction: 'desc' }]
        };

        if (filters.status) {
            options.filterByFormula = `{Status} = "${filters.status}"`;
        }

        return await this.fetchRecords('Contact Inquiries', options);
    }

    async addInquiry(inquiryData) {
        const fields = {
            'First Name': inquiryData.firstName,
            'Last Name': inquiryData.lastName,
            'Email': inquiryData.email,
            'Phone': inquiryData.phone || '',
            'Preferred Messenger': inquiryData.messenger || '',
            'Message': inquiryData.message,
            'Status': 'New'
        };

        return await this.createRecord('Contact Inquiries', fields);
    }

    // Utility methods
    async getStats() {
        try {
            const [albums, tracks, posts, subscribers] = await Promise.all([
                this.fetchRecords('Albums', { maxRecords: 1000 }),
                this.fetchRecords('Tracks', { maxRecords: 1000 }),
                this.fetchRecords('Blog Posts', { maxRecords: 1000 }),
                this.fetchRecords('Subscribers', { maxRecords: 1000 })
            ]);

            return {
                albums: albums.records?.length || 0,
                tracks: tracks.records?.length || 0,
                posts: posts.records?.length || 0,
                subscribers: subscribers.records?.length || 0
            };
        } catch (error) {
            console.error('Error fetching stats:', error);
            return { albums: 0, tracks: 0, posts: 0, subscribers: 0 };
        }
    }
}

// Configuration and initialization
class YeggeAPI {
    constructor() {
        this.airtable = null;
        this.isInitialized = false;
    }

    init(apiKey, baseId) {
        if (!apiKey || !baseId) {
            console.error('Airtable API key and base ID are required');
            return false;
        }

        this.airtable = new AirtableAPI(apiKey, baseId);
        this.isInitialized = true;
        return true;
    }

    // Public methods that check initialization
    async getAlbums(filters = {}) {
        if (!this.isInitialized) {
            console.error('YeggeAPI not initialized');
            return { records: [] };
        }
        return await this.airtable.getAlbums(filters);
    }

    async getTracks(albumId = null) {
        if (!this.isInitialized) {
            console.error('YeggeAPI not initialized');
            return { records: [] };
        }
        return await this.airtable.getTracks(albumId);
    }

    async getBlogPosts(filters = {}) {
        if (!this.isInitialized) {
            console.error('YeggeAPI not initialized');
            return { records: [] };
        }
        return await this.airtable.getBlogPosts(filters);
    }

    async getBlogPostBySlug(slug) {
        if (!this.isInitialized) {
            console.error('YeggeAPI not initialized');
            return null;
        }
        return await this.airtable.getBlogPostBySlug(slug);
    }

    async addSubscriber(data) {
        if (!this.isInitialized) {
            console.error('YeggeAPI not initialized');
            throw new Error('API not initialized');
        }
        return await this.airtable.addSubscriber(data);
    }

    async addInquiry(data) {
        if (!this.isInitialized) {
            console.error('YeggeAPI not initialized');
            throw new Error('API not initialized');
        }
        return await this.airtable.addInquiry(data);
    }

    async getStats() {
        if (!this.isInitialized) {
            console.error('YeggeAPI not initialized');
            return { albums: 0, tracks: 0, posts: 0, subscribers: 0 };
        }
        return await this.airtable.getStats();
    }

    // Admin methods (require full access)
    async getAllBlogPosts() {
        if (!this.isInitialized) {
            console.error('YeggeAPI not initialized');
            return { records: [] };
        }
        return await this.airtable.getBlogPosts({ includeStatus: 'all' });
    }

    async getSubscribers() {
        if (!this.isInitialized) {
            console.error('YeggeAPI not initialized');
            return { records: [] };
        }
        return await this.airtable.getSubscribers();
    }

    async getInquiries() {
        if (!this.isInitialized) {
            console.error('YeggeAPI not initialized');
            return { records: [] };
        }
        return await this.airtable.getInquiries();
    }

    // Pass through admin methods
    async createRecord(tableName, fields) {
        if (!this.isInitialized) {
            throw new Error('API not initialized');
        }
        return await this.airtable.createRecord(tableName, fields);
    }

    async updateRecord(tableName, recordId, fields) {
        if (!this.isInitialized) {
            throw new Error('API not initialized');
        }
        return await this.airtable.updateRecord(tableName, recordId, fields);
    }

    async deleteRecord(tableName, recordId) {
        if (!this.isInitialized) {
            throw new Error('API not initialized');
        }
        return await this.airtable.deleteRecord(tableName, recordId);
    }
}

// Create global instance
window.yeggeAPI = new YeggeAPI();

// Utility functions for data processing
window.AirtableUtils = {
    // Format album data for display
    formatAlbumData(record) {
        const fields = record.fields;
        return {
            id: record.id,
            title: fields['Album Name'] || 'Untitled',
            artist: fields['Album Artist'] || 'Unknown Artist',
            type: fields['Album Type'] || 'Unknown',
            catalogNo: fields['Catalog No.'] || 'N/A',
            releaseDate: fields['Release Date'],
            status: fields['Album Status'] || 'Unknown',
            visibility: fields['Visibility'] || 'PUBLIC',
            artwork: fields['Artwork Gallery'] || [],
            commentary: fields['Album Commentary'] || '',
            streamingLinks: {
                spotify: fields['Spotify'],
                appleMusic: fields['Apple Music'],
                youtubeMusic: fields['Youtube Music'],
                itunes: fields['iTunes'],
                amazonMusic: fields['Amazon Music'],
                tidal: fields['Tidal']
            },
            purchaseLinks: {
                cd: fields['CD Purchase'],
                vinyl: fields['Vinyl Purchase'],
                digital: fields['Digital Download']
            }
        };
    },

    // Format blog post data
    formatBlogPost(record) {
        const fields = record.fields;
        return {
            id: record.id,
            title: fields['Title'] || 'Untitled',
            content: fields['Content'] || '',
            excerpt: fields['Excerpt'] || '',
            category: fields['Category'] || 'uncategorized',
            tags: fields['Tags'] ? fields['Tags'].split(',').map(tag => tag.trim()) : [],
            author: fields['Author'] || 'Brian Yegge',
            publishDate: fields['Publish Date'],
            status: fields['Status'] || 'Draft',
            slug: fields['Slug'] || this.generateSlug(fields['Title']),
            featuredImage: fields['Featured Image'] ? fields['Featured Image'][0] : null
        };
    },

    // Generate URL-friendly slug from title
    generateSlug(title) {
        if (!title) return 'untitled';
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    },

    // Format dates for display
    formatDate(dateString) {
        if (!dateString) return 'TBA';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    // Calculate reading time
    calculateReadTime(content) {
        if (!content) return '1 min read';
        const wordsPerMinute = 200;
        const textContent = content.replace(/<[^>]*>/g, '');
        const wordCount = textContent.trim().split(/\s+/).length;
        const readTime = Math.ceil(wordCount / wordsPerMinute);
        return `${readTime} min read`;
    },

    // Filter albums by artist for domain-specific views
    filterAlbumsByDomain() {
        const hostname = window.location.hostname;
        if (hostname.includes('angershade')) {
            return 'Angershade';
        } else if (hostname.includes('thecorruptive')) {
            return 'The Corruptive';
        }
        return null; // Show all for main domain
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AirtableAPI, YeggeAPI };
}