const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Generate VAPID keys - do this once and save the keys
const vapidKeys = webpush.generateVAPIDKeys();

// Configure web-push
webpush.setVapidDetails(
    'mailto:palabricaubi@gmail.com', // Replace with your email
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Store subscriptions (in production, use a database)
let subscriptions = new Map();

// Subscribe route
app.post('/api/subscribe', (req, res) => {
    const subscription = req.body;
    const subId = JSON.stringify(subscription);
    subscriptions.set(subId, subscription);
    
    console.log('New subscription:', subId);
    res.status(201).json({
        message: 'Successfully subscribed',
        publicKey: vapidKeys.publicKey
    });
});

// Schedule notification function
function scheduleNotification(subscription, task, timeUntilDeadline) {
    setTimeout(async () => {
        const payload = JSON.stringify({
            title: 'TaskWave Reminder',
            body: `Task "${task.text}" is due ${timeUntilDeadline === 86400000 ? 'tomorrow' : 'in 30 minutes'}!`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            data: {
                url: '/',
                taskId: task.id
            }
        });

        try {
            await webpush.sendNotification(subscription, payload);
            console.log('Notification sent successfully');
        } catch (error) {
            console.error('Error sending notification:', error);
            if (error.statusCode === 410) {
                const subId = JSON.stringify(subscription);
                subscriptions.delete(subId);
            }
        }
    }, timeUntilDeadline);
}

// Add task route
app.post('/api/task', (req, res) => {
    const task = req.body;
    const now = Date.now();
    const deadline = new Date(task.deadline).getTime();

    subscriptions.forEach(subscription => {
        // Schedule 1-day notification
        if (deadline - now > 86400000) {
            scheduleNotification(subscription, task, 86400000);
        }
        
        // Schedule 30-minute notification
        if (deadline - now > 1800000) {
            scheduleNotification(subscription, task, 1800000);
        }
    });

    res.status(201).json({
        message: 'Task notifications scheduled',
        taskId: task.id
    });
});

// Get VAPID public key
app.get('/api/vapidPublicKey', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('VAPID Public Key:', vapidKeys.publicKey);
    console.log('VAPID Private Key:', vapidKeys.privateKey);
});