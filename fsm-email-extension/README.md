# FSM Email Notifier — SAP FSM Custom Extension

A plug-and-play SAP Field Service Management Custom Extension that automatically sends email notifications to the assigned Field Service Engineer (FSE) and configured Distribution Lists (DLs) whenever an **Activity** or **Reservation** is **created or updated**.

---

## 📦 Contents

```
fsm-email-extension/
├── index.html          ← Extension entry point (FSM Shell loads this)
├── styles.css          ← UI stylesheet
├── config.js           ← Config persistence (localStorage)
├── emailService.js     ← EmailJS email dispatch logic
├── fsmExtension.js     ← SAP FSM Shell SDK integration + event handling
├── ui.js               ← DOM helpers, event feed, log, toasts
├── manifest.json       ← Extension descriptor for FSM App Store
└── README.md           ← This file
```

---

## 🚀 Quick Start

### Step 1 — Set Up EmailJS (Free, No Backend Required)

1. Go to [https://www.emailjs.com](https://www.emailjs.com) and create a free account.
2. **Add an Email Service**: Connect Gmail, Outlook, or any SMTP provider.
   - Copy the **Service ID** (e.g. `service_abc123`)
3. **Create an Email Template** with these variables:
   ```
   To:       {{to_email}}
   Subject:  {{subject}}
   Body:     {{message_html}}   ← set as HTML content
   ```
   - Copy the **Template ID** (e.g. `template_xyz789`)
4. Go to **Account → API Keys** and copy your **Public Key**.

### Step 2 — Register the Extension in SAP FSM

1. Log into your SAP FSM tenant as an Administrator.
2. Navigate to **Admin → Extensions → Custom Extensions**.
3. Click **Upload Extension** and upload this entire folder as a `.zip` file.
4. Set the **Entry Point** to `index.html`.
5. Configure the required permissions in the manifest.
6. **Publish** the extension.

### Step 3 — Configure the Extension UI

Once the extension is running inside FSM:

1. Open the **Email Configuration** panel.
2. Enter your **EmailJS Service ID**, **Template ID**, and **Public Key**.
3. Add one or more **Distribution List (DL)** emails.
4. Enable/disable the specific triggers you want:
   - ✅ Activity Created
   - ✅ Activity Updated
   - ✅ Reservation Created
   - ✅ Reservation Updated
5. Click **Save Configuration**.
6. Use **Send Test Email** to verify the setup.

---

## 🔧 How It Works

```
SAP FSM Shell
     │
     │  OBJECT_SAVE / OBJECT_UPDATE events
     ▼
fsmExtension.js
     │
     ├── Detect entity type (Activity / Reservation)
     ├── Check trigger settings
     ├── Extract entity fields
     ├── Query FSM Core API → resolve FSE email from Person record
     │
     ▼
emailService.js
     │
     ├── Build HTML email (rich, branded template)
     ├── Build subject line
     │
     ▼
EmailJS SDK
     │
     ├── Send to FSE email
     └── Send to each DL email
```

---

## 📧 Email Template Variables

Configure your EmailJS template to use these variables:

| Variable         | Description                              |
|-----------------|------------------------------------------|
| `{{to_email}}`  | Recipient email address                  |
| `{{to_name}}`   | Recipient name / email                   |
| `{{from_name}}` | Sender display name                      |
| `{{subject}}`   | Email subject line                       |
| `{{message_html}}` | Full HTML email body                  |
| `{{message}}`   | Plain text fallback                      |
| `{{event_type}}`| CREATE or UPDATE                        |
| `{{object_type}}`| ACTIVITY or RESERVATION               |
| `{{object_id}}` | The FSM entity ID                        |

---

## 🔐 Security Notes

- **No backend required** — EmailJS sends emails directly from the browser.
- Your EmailJS credentials are stored in **browser localStorage** within the FSM iframe.
- For production, consider using **EmailJS Restricted Keys** with domain restrictions.
- The FSM Auth Token used for API calls is obtained from the FSM Shell context and is never stored.

---

## 🧪 Demo Mode

If loaded outside of FSM Shell (e.g. opened directly in a browser), the extension runs in **Demo Mode**:
- Simulates 3 FSM events at 3s, 8s, and 14s intervals.
- Email sending is attempted for any configured DL emails.
- The connection badge shows **Demo Mode**.

---

## 📋 FSM API Query (FSE Email Lookup)

The extension uses the FSM Core API v4 to resolve engineer emails:

```sql
SELECT p.email FROM Person p WHERE p.externalId = '<technicianCode>'
```

Endpoint: `GET https://{cloudHost}/api/v4/{account}/{company}/query`

---

## 🛠 Customization

### Add More Entity Types
In `fsmExtension.js`, extend `detectObjectType()` and add extraction logic in `extractEntityData()`.

### Change Email Design
Edit the `buildEmailBody()` function in `emailService.js` — it returns raw HTML.

### Add CC / BCC
Modify `sendNotificationEmails()` to pass additional EmailJS template params and update your template.

---

## 📄 License

MIT — Free to use and modify for your SAP FSM implementation.
