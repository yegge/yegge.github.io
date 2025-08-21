// config.js - Configuration file
// Place this file in /assets/js/config.js

// Airtable Configuration
const AIRTABLE_CONFIG = {
    // REPLACE THESE WITH YOUR ACTUAL VALUES:
    API_KEY: 'patH1TfLGuWCLL20v.2762adc2d9d0b522b6a07f114ffccd5c726bad3af4fe0f0976499b624ab10244', // Get from https://airtable.com/account
    BASE_ID: 'appFz3KUByYEd86qA', // Found in your Airtable base URL
    
    // Table names (these should match your Airtable base exactly)
    TABLES: {
        ALBUMS: 'Albums',
        TRACKS: 'Tracks',
        BLOG_POSTS: 'Blog Posts',
        SUBSCRIBERS: 'Subscribers',
        CONTACT_INQUIRIES: 'Contact Inquiries'
    }
};

// Initialize the API when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Airtable connection
    const initialized = window.yeggeAPI.init(AIRTABLE_CONFIG.API_KEY, AIRTABLE_CONFIG.BASE_ID);
    
    if (initialized) {
        console.log('Airtable API initialized successfully');
        
        // Load initial data based on current page
        initializePageData();
    } else {
        console.error('Failed to initialize Airtable API');
        console.error('Please check your API_KEY and BASE_ID in config.js');
    }
});

// Initialize data for specific pages
async function initializePageData() {
    const currentPage = getCurrentPage();
    
    try {
        switch (currentPage) {
            case 'home':
                await loadHomePageData();
                break;
            case 'blog':
                await loadBlogData();
                break;
            case 'admin':
                await loadAdminData();
                break;
            case 'blog-post':
                await loadBlogPostData();
                break;
        }
    } catch (error) {
        console.error('Error loading page data:', error);
        showErrorMessage('Failed to load content. Please check your internet connection.');
    }
}

// Determine current page
function getCurrentPage() {
    const path = window.location.pathname;
    
    if (path.includes('blog.html')) return 'blog';
    if (path.includes('admin.html')) return 'admin';
    if (path.includes('/blog/') && path.includes('.html')) return 'blog-post';
    return 'home';
}

// Load data for home page
async function loadHomePageData() {
    try {
        // Determine if we need to filter by artist based on domain
        const artistFilter = window.AirtableUtils.filterAlbumsByDomain();
        const filters = artistFilter ? { artist: artistFilter } : {};
        
        // Load albums for music section
        const albumsResponse = await window.yeggeAPI.getAlbums(filters);
        
        if (albumsResponse && albumsResponse.records) {
            renderAlbumsOnHomePage(albumsResponse.records);
        }
        
        // Load recent blog posts for preview
        const postsResponse = await window.yeggeAPI.getBlogPosts({ maxRecords: 3 });
        
        if (postsResponse && postsResponse.records) {
            renderRecentPosts(postsResponse.records);
        }
        
    } catch (error) {
        console.error('Error loading home page data:', error);
    }
}

// Load data for blog page
async function loadBlogData() {
    if (typeof loadBlogPosts === 'function') {
        await loadBlogPosts();
    }
}

// Load data for admin page
async function loadAdminData() {
    if (typeof loadDashboard === 'function') {
        await loadDashboard();
    }
}

// Load data for individual blog post
async function loadBlogPostData() {
    if (typeof loadBlogPost === 'function') {
        await loadBlogPost();
    }
}

// Render albums on home page
function renderAlbumsOnHomePage(albums) {
    const albumGrid = document.getElementById('albumGrid');
    if (!albumGrid) return;
    
    albumGrid.innerHTML = '';
    
    albums.forEach(record => {
        const album = window.AirtableUtils.formatAlbumData(record);
        const albumCard = createAlbumCard(album);
        albumGrid.appendChild(albumCard);
    });
}

// Create album card element
function createAlbumCard(album) {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.setAttribute('data-artist', album.artist.toLowerCase().replace(/\s+/g, ''));
    card.setAttribute('data-status', album.status.toLowerCase());

    const frontCover = album.artwork && album.artwork.length > 0 ? album.artwork[0] : null;
    const artworkHtml = frontCover 
        ? `<img src="${frontCover.url}" alt="${album.title} Cover" style="width: 100%; height: 100%; object-fit: cover;">`
        : '<i class="fas fa-image fa-3x"></i>';

    card.innerHTML = `
        <div class="album-artwork" onclick="openGallery(['${frontCover ? frontCover.url : ''}'])">
            ${artworkHtml}
        </div>
        <div class="album-info">
            <h3 class="album-title">${album.title}</h3>
            <p class="album-artist">${album.artist}</p>
            <div class="album-details">
                <p><strong>TYPE:</strong> ${album.type}</p>
                <p><strong>CATALOG:</strong> ${album.catalogNo}</p>
                <p><strong>RELEASE:</strong> ${window.AirtableUtils.formatDate(album.releaseDate)}</p>
            </div>
            ${createStreamingLinksHtml(album.streamingLinks)}
        </div>
    `;

    return card;
}

// Create streaming links HTML
function createStreamingLinksHtml(links) {
    const linkElements = [];
    
    Object.entries(links).forEach(([platform, url]) => {
        if (url) {
            const displayName = platform === 'appleMusic' ? 'APPLE MUSIC' : 
                              platform === 'youtubeMusic' ? 'YOUTUBE MUSIC' : 
                              platform === 'amazonMusic' ? 'AMAZON MUSIC' : 
                              platform.toUpperCase();
            linkElements.push(`<a href="${url}" target="_blank" class="streaming-link">${displayName}</a>`);
        }
    });

    return linkElements.length > 0 ? `<div class="streaming-links">${linkElements.join('')}</div>` : '';
}

// Render recent blog posts
function renderRecentPosts(posts) {
    const container = document.getElementById('recentPosts');
    if (!container) return;
    
    container.innerHTML = posts.map(record => {
        const post = window.AirtableUtils.formatBlogPost(record);
        return `
            <article class="recent-post">
                <h4><a href="/blog/${post.slug}.html">${post.title}</a></h4>
                <p class="post-meta">${window.AirtableUtils.formatDate(post.publishDate)} • ${post.category.toUpperCase()}</p>
                <p class="post-excerpt">${post.excerpt}</p>
            </article>
        `;
    }).join('');
}

// Error handling
function showErrorMessage(message) {
    // Create or update error message element
    let errorElement = document.getElementById('error-message');
    
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'error-message';
        errorElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #ff3860;
            color: white;
            padding: 1rem;
            border-radius: 4px;
            z-index: 1000;
            max-width: 300px;
        `;
        document.body.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

// Form submission handlers
async function handleSubscribeForm(formData) {
    try {
        const subscriberData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            country: formData.get('country'),
            subscribe: formData.get('subscribe') === 'on'
        };

        await window.yeggeAPI.addSubscriber(subscriberData);
        return { success: true, message: 'Thank you for subscribing!' };
    } catch (error) {
        console.error('Error submitting subscription:', error);
        return { success: false, message: 'Failed to subscribe. Please try again.' };
    }
}

async function handleContactForm(formData) {
    try {
        const inquiryData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            messenger: formData.get('messenger'),
            message: formData.get('message')
        };

        await window.yeggeAPI.addInquiry(inquiryData);
        return { success: true, message: 'Thank you for your inquiry! We will get back to you soon.' };
    } catch (error) {
        console.error('Error submitting inquiry:', error);
        return { success: false, message: 'Failed to send inquiry. Please try again.' };
    }
}

// Make functions available globally
window.handleSubscribeForm = handleSubscribeForm;
window.handleContactForm = handleContactForm;