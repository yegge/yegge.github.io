# Airtable Integration Setup Guide

## Step 1: Get Your Airtable Credentials

### 1.1 Get Your API Key
1. Go to [https://airtable.com/account](https://airtable.com/account)
2. In the "API" section, click "Generate personal access token"
3. Give it a name like "Yegge Website"
4. Set the scopes to include:
   - `data.records:read` (to read records)
   - `data.records:write` (to create/update records)
   - `schema.bases:read` (to read base schema)
5. Select your base from the list
6. Click "Create token"
7. **Copy and save this token** - you won't see it again!

### 1.2 Get Your Base ID
1. Go to your Airtable base
2. Look at the URL: `https://airtable.com/app[BASE_ID]/...`
3. Copy the `app...` part (including "app")
4. This is your Base ID

## Step 2: Configure Your Website

### 2.1 Update the Configuration File
1. Open `/assets/js/config.js`
2. Replace the placeholder values:

```javascript
const AIRTABLE_CONFIG = {
    API_KEY: 'patXXXXXXXXXXXXXX', // Your actual token from step 1.1
    BASE_ID: 'appXXXXXXXXXXXXXX',  // Your actual base ID from step 1.2
    
    // Keep these table names as-is (they match the schema)
    TABLES: {
        ALBUMS: 'Albums',
        TRACKS: 'Tracks',
        BLOG_POSTS: 'Blog Posts',
        SUBSCRIBERS: 'Subscribers',
        CONTACT_INQUIRIES: 'Contact Inquiries'
    }
};
```

### 2.2 Add the Scripts to Your HTML Files
Update your HTML files to include the Airtable integration:

**For index.html** - Add before the closing `</body>` tag:
```html
<!-- Airtable Integration -->
<script src="/assets/js/airtable.js"></script>
<script src="/assets/js/config.js"></script>
```

**For blog.html** - Add before the closing `</body>` tag:
```html
<!-- Airtable Integration -->
<script src="/assets/js/airtable.js"></script>
<script src="/assets/js/config.js"></script>
```

**For admin.html** - Update the airtableConfig object:
```javascript
let airtableConfig = {
    apiKey: 'YOUR_AIRTABLE_API_KEY', // Same as in config.js
    baseId: 'YOUR_BASE_ID',          // Same as in config.js
    baseUrl: 'https://api.airtable.com/v0/'
};
```

## Step 3: Update Your Main Website Code

### 3.1 Update Form Handlers in index.html
Replace the existing form submission handlers with these updated versions:

```javascript
// Update the handleSubscribeSubmit function
async function handleSubscribeSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const result = await window.handleSubscribeForm(formData);
        
        if (result.success) {
            alert(result.message);
            e.target.reset();
        } else {
            alert(result.message);
        }
    } catch (error) {
        alert('Error: Please try again later.');
        console.error('Subscription error:', error);
    }
}

// Update the handleContactSubmit function
async function handleContactSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const result = await window.handleContactForm(formData);
        
        if (result.success) {
            alert(result.message);
            e.target.reset();
        } else {
            alert(result.message);
        }
    } catch (error) {
        alert('Error: Please try again later.');
        console.error('Contact error:', error);
    }
}
```

### 3.2 Update Blog Pages

**For blog.html** - Replace the `fetchBlogPosts` function:
```javascript
// Replace the existing fetchBlogPosts function
async function fetchBlogPosts() {
    try {
        const response = await window.yeggeAPI.getBlogPosts();
        
        if (response && response.records) {
            return response.records.map(record => 
                window.AirtableUtils.formatBlogPost(record)
            );
        }
        
        return [];
    } catch (error) {
        console.error('Error fetching blog posts:', error);
        return [];
    }
}
```

**For individual blog post pages** - Replace the `fetchBlogPost` function:
```javascript
// Replace the existing fetchBlogPost function
async function fetchBlogPost(slug) {
    try {
        const record = await window.yeggeAPI.getBlogPostBySlug(slug);
        
        if (record) {
            return window.AirtableUtils.formatBlogPost(record);
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching blog post:', error);
        return null;
    }
}
```

## Step 4: Set Up Your Airtable Data

### 4.1 Required Fields in Each Table

**Albums Table - Required Fields:**
- Album Name (Single line text)
- Album Artist (Single select: "Angershade", "The Corruptive")
- Album Type (Single select: "EP", "LP", "SP")
- Visibility (Single select: "PUBLIC", "VIP", "ADMIN")
- Album Status (Single select: "In Development", "Released", "Removed")

**Blog Posts Table - Required Fields:**
- Title (Single line text)
- Content (Long text)
- Category (Single select: "Yegge", "Angershade", "The Corruptive")
- Status (Single select: "Draft", "Published", "Scheduled")
- Publish Date (Date)
- Slug (Single line text) - URL-friendly version of title

**Subscribers Table - Auto-populated by forms:**
- First Name, Last Name, Email, Country (required)
- Phone (optional)
- Subscribe Updates (Checkbox, default checked)

**Contact Inquiries Table - Auto-populated by forms:**
- First Name, Last Name, Email, Message (required)
- Phone, Preferred Messenger (optional)

### 4.2 Add Sample Data

**Sample Album Record:**
```
Album Name: "Sample EP"
Album Artist: "Angershade"
Album Type: "EP"
Catalog No.: "YGG-I"
Release Date: "2025-01-15"
Album Status: "Released"
Visibility: "PUBLIC"
Album Commentary: "A sample release for testing"
```

**Sample Blog Post:**
```
Title: "Welcome to Yegge"
Content: "<p>Welcome to our website...</p>"
Category: "Yegge"
Status: "Published"
Publish Date: "2025-08-19"
Slug: "welcome-to-yegge"
Excerpt: "Welcome to the official Yegge website"
Author: "Brian Yegge"
```

## Step 5: Test the Integration

### 5.1 Test Basic Connection
1. Open your website in a browser
2. Open browser Developer Tools (F12)
3. Check the Console for messages:
   - Should see: "Airtable API initialized successfully"
   - Should NOT see: "Failed to initialize Airtable API"

### 5.2 Test Forms
1. **Newsletter Signup:**
   - Fill out the subscribe form
   - Submit it
   - Check your Airtable Subscribers table for the new record

2. **Contact Form:**
   - Fill out the contact form
   - Submit it
   - Check your Airtable Contact Inquiries table for the new record

### 5.3 Test Content Display
1. **Albums:** Add a PUBLIC album in Airtable, refresh your website
2. **Blog Posts:** Add a Published blog post, check if it appears on /blog.html

## Step 6: Troubleshooting

### Common Issues:

**"Failed to initialize Airtable API"**
- Check that your API key and Base ID are correct in config.js
- Verify the API key has proper permissions
- Check that table names match exactly (case-sensitive)

**"CORS Error" or "Access Denied"**
- Verify your API token has the correct scopes
- Make sure your base is selected in the token permissions
- Check that you're using a Personal Access Token, not the old API key format

**Forms not submitting:**
- Check browser console for JavaScript errors
- Verify field names match between HTML forms and Airtable fields
- Ensure required fields are filled out

**Content not loading:**
- Check that records have the correct Status/Visibility values
- Verify Publish Date is in the past for blog posts
- Check filtering logic in the console

### Debug Steps:

1. **Check API Response:**
```javascript
// Run this in browser console to test connection
window.yeggeAPI.getAlbums().then(data => console.log('Albums:', data));
```

2. **Check Individual Records:**
```javascript
// Test blog posts
window.yeggeAPI.getBlogPosts().then(data => console.log('Blog Posts:', data));
```

3. **Verify Data Format:**
```javascript
// Check if data is being formatted correctly
window.yeggeAPI.getAlbums().then(response => {
    if (response.records) {
        const formatted = response.records.map(r => window.AirtableUtils.formatAlbumData(r));
        console.log('Formatted Albums:', formatted);
    }
});
```

## Step 7: Security Considerations

### 7.1 API Key Security
- **Never commit your API key to public repositories**
- For production, consider using environment variables
- Rotate your API key periodically

### 7.2 Rate Limiting
- Airtable has rate limits (5 requests per second)
- The integration includes basic error handling
- For high-traffic sites, consider caching responses

### 7.3 Data Validation
- The integration includes basic validation
- Add additional client-side validation as needed
- Always validate data server-side for production use

## Step 8: Going Live

### 8.1 Environment Variables (Recommended)
For production deployment on Cloudflare Pages:

1. In Cloudflare Pages dashboard, go to Settings > Environment Variables
2. Add:
   - `AIRTABLE_API_KEY`: Your API key
   - `AIRTABLE_BASE_ID`: Your base ID

3. Update config.js to use environment variables:
```javascript
const AIRTABLE_CONFIG = {
    API_KEY: process.env.AIRTABLE_API_KEY || 'YOUR_FALLBACK_KEY',
    BASE_ID: process.env.AIRTABLE_BASE_ID || 'YOUR_FALLBACK_BASE_ID',
    // ... rest of config
};
```

### 8.2 Performance Optimization
- Implement caching for frequently accessed data
- Use pagination for large datasets
- Consider lazy loading for non-critical content

## Step 9: Maintenance

### 9.1 Regular Tasks
- Monitor Airtable usage (free tier has limits)
- Back up your Airtable data regularly
- Update content through the admin panel
- Check for and fix any broken links

### 9.2 Monitoring
- Set up error logging for failed API calls
- Monitor form submission success rates
- Track website performance impact

With this integration complete, your website will automatically pull content from Airtable and allow visitors to submit forms that save directly to your database. The system is designed to be robust and handle errors gracefully while providing a seamless user experience.