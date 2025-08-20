# Airtable Database Schema for Yegge Website

## Base Structure

Create a new Airtable base with the following tables:

### 1. Albums Table

| Field Name | Field Type | Options/Description |
|------------|------------|-------------------|
| ID | Autonumber | Primary Key (automatic) |
| Album Name | Single line text | |
| Album Type | Single select | Options: EP, LP, SP |
| Album Artist | Single select | Options: Angershade, The Corruptive |
| Catalog No. | Single line text | Display as Roman Numeral on frontend |
| UPC | Single line text | Hidden field |
| Distributor | Single line text | Optional link |
| Label | Single line text | Optional link |
| Release Date | Date | |
| Removal Date | Date | Optional |
| Vinyl CD Release Date | Date | Optional |
| Producer | Multiple select | Allow multiple entries |
| Engineer | Multiple select | Allow multiple entries |
| Mastering | Multiple select | Allow multiple entries |
| Key Contributors | Long text | Name & Contribution pairs |
| Album Status | Single select | Options: In Development, Released, Removed |
| Visibility | Single select | Options: PUBLIC, ADMIN, VIP |
| Apple Music | URL | Streaming link |
| Spotify | URL | Streaming link |
| Youtube Music | URL | Streaming link |
| iTunes | URL | Streaming link |
| Amazon Music | URL | Streaming link |
| Tidal | URL | Streaming link |
| CD Purchase | URL | Purchase link |
| Vinyl Purchase | URL | Purchase link |
| Digital Download | URL | Purchase link |
| Album Commentary | Long text | |
| Artwork Gallery | Attachment | Multiple images (Front, Back, Sleeve, Sticker) |

### 2. Tracks Table

| Field Name | Field Type | Options/Description |
|------------|------------|-------------------|
| Track ID | Autonumber | Primary Key (automatic) |
| Album ID | Link to record | Link to Albums table |
| Track No. | Number | For sorting within album |
| Track Name | Single line text | |
| Artist Name | Multiple select | Allow multiple artists |
| Composer | Multiple select | Allow multiple composers |
| Key Contributors | Long text | Name & contribution pairs |
| ISRC | Single line text | Hidden field |
| Track Status | Single select | Options: WIP, B-SIDE, RELEASED, SHELVED |
| Stage of Production | Single select | Options: CONCEPTION, DEMO, IN SESSION, OUT SESSION, MIXDOWN, MASTERING, DISTRIBUTION, SHELVED, REMOVED, RELEASED |
| Stage Date | Date | Auto-updates based on status |
| Visibility | Formula | Inherits from Album Visibility |
| Track Duration | Duration | MM:SS format |
| Stream Embed | Long text | Embedded player code |
| Prevent Streaming | Checkbox | Adds overlay to prevent playback |
| Digital Purchase | URL | Purchase download link |
| Track Commentary | Long text | |

### 3. Blog Posts Table

| Field Name | Field Type | Options/Description |
|------------|------------|-------------------|
| Post ID | Autonumber | Primary Key (automatic) |
| Title | Single line text | |
| Content | Long text | Support for HTML/Markdown |
| Category | Single select | Options: Angershade, The Corruptive, Yegge |
| Tags | Multiple select | Flexible tagging system |
| Author | Single line text | Default: Brian Yegge |
| Status | Single select | Options: Draft, Published, Scheduled |
| Publish Date | Date | |
| Created Date | Created time | Automatic |
| Modified Date | Last modified time | Automatic |
| Featured Image | Attachment | Optional header image |
| Excerpt | Long text | Optional short description |
| SEO Title | Single line text | Optional |
| SEO Description | Long text | Optional |

### 4. Subscribers Table

| Field Name | Field Type | Options/Description |
|------------|------------|-------------------|
| ID | Autonumber | Primary Key (automatic) |
| First Name | Single line text | |
| Last Name | Single line text | |
| Email | Email | |
| Phone | Phone number | |
| Country | Single select | Full country list |
| Subscribe Updates | Checkbox | Default: checked |
| Signup Date | Created time | Automatic |
| Status | Single select | Options: Active, Unsubscribed, Bounced |
| Source | Single line text | Track signup source |

### 5. Contact Inquiries Table

| Field Name | Field Type | Options/Description |
|------------|------------|-------------------|
| ID | Autonumber | Primary Key (automatic) |
| First Name | Single line text | |
| Last Name | Single line text | |
| Email | Email | |
| Phone | Phone number | |
| Preferred Messenger | Single select | Options: iMessage, SMS, Facebook Messenger, WhatsApp |
| Message | Long text | |
| Status | Single select | Options: New, In Progress, Responded, Closed |
| Inquiry Date | Created time | Automatic |
| Response Date | Date | Optional |
| Notes | Long text | Internal notes |

## API Configuration

### Required Steps:

1. **Create Airtable Account** and new base
2. **Generate API Key**: 
   - Go to https://airtable.com/account
   - Generate personal access token
3. **Get Base ID**:
   - Found in your base URL: `https://airtable.com/app[BASE_ID]/...`
4. **Set Permissions**:
   - Ensure API can read/write to all tables
   - Set proper view filters for public/admin access

### Environment Variables:
```bash
AIRTABLE_API_KEY=your_personal_access_token_here
AIRTABLE_BASE_ID=your_base_id_here
```

## View Configuration

### Albums Table Views:
- **All Albums**: No filters
- **Public Albums**: `{Visibility} = "PUBLIC"`
- **Angershade Albums**: `{Album Artist} = "Angershade"`
- **The Corruptive Albums**: `{Album Artist} = "The Corruptive"`
- **Released Albums**: `{Album Status} = "Released"`

### Blog Posts Views:
- **Published Posts**: `{Status} = "Published"`
- **Scheduled Posts**: `{Status} = "Scheduled"`
- **Drafts**: `{Status} = "Draft"`
- **By Category**: Filter by each category

### Automation Ideas:
1. **Auto-update Track Stage Date** when Stage of Production changes
2. **Email notifications** for new contact inquiries
3. **Auto-publish** scheduled blog posts
4. **Subscriber welcome email** automation

## Security Considerations:

- Use environment variables for API keys
- Implement proper filtering on frontend to respect visibility settings
- Never expose admin/VIP content to public API calls
- Consider using Airtable's built-in authentication for admin access