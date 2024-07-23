const express = require('express');
const { google } = require('googleapis');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = 3000;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.on('tokens', (tokens) => {
  if (tokens.refresh_token) {
    oauth2Client.setCredentials({
      refresh_token: tokens.refresh_token
    });
  }
});

app.get('/', (req, res) => {
  res.send('Hello World!!');
});


app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ],
  });
  res.redirect(authUrl);
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);
    res.redirect('http://localhost:5173')
  } catch (error) {
    res.status(500).send('Authentication failed');
  }
});

/**
 * Get the list of events from the Google Calendar
 */
app.get('/events', async (req, res) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = response.data.items;
    if (!events || events.length === 0) {
      res.send('No upcoming events found.');
      return;
    }

    res.json(events);
  } catch (error) {
    console.error('error', error);
    res.status(500).send('Failed to fetch events');
  }
});

// 캘린더 목록을 가져오는 엔드포인트
app.get('/calendarList', async (req, res) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.calendarList.list();
    res.json(response.data.items);
  } catch (error) {
    res.status(500).send('Failed to fetch calendar list');
  }
});

// 일정 등록 엔드포인트
app.post('/addEvent', async (req, res) => {
  try {
    const { summary, location, description, start, end } = req.body;
    
    const timeZone = 'Asia/Seoul';
    const event = {
      summary,
      location,
      description,
      start: {
        dateTime: start,
        timeZone, // 적절한 시간대를 설정하세요.
      },
      end: {
        dateTime: end,
        timeZone, // 적절한 시간대를 설정하세요.
      },
    };

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
    res.json(response.data);
  } catch (error) {
    console.error('error', error);
    res.status(500).send('Failed to create event');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
