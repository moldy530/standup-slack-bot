import { App } from '@slack/bolt';

const token = process.env.SLACK_BOT_TOKEN;
const oauthToken = process.env.SLACK_USER_TOKEN;

// Initializes your app with your bot token and signing secret
const app = new App({
    token: token,
    signingSecret: process.env.SLACK_SIGNING_SECRET
});

const labels = {
    STANDUP_YESTERDAY: 'standup_yest',
    STANDUP_TODAY: 'standup_today',
};

app.use(async ({ action, next, ack, say, respond, ...props }) => {
    if (action && action.type === 'dialog_submission') {
        ack();

        const { submission } = action;

        const submittedDate = new Date();

        const result = await app.client.chat.postMessage({
            token: oauthToken,
            channel: props.payload.channel.id,
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*What I did yesterday:*\n${submission[labels.STANDUP_YESTERDAY]}`
                    }
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*What I'm doing today:*\n${submission[labels.STANDUP_TODAY]}`,
                    },
                },
                {
                    type: 'context',
                    elements: [{
                        type: 'mrkdwn',
                        text: `submitted ${submittedDate.toLocaleDateString()} @ ${submittedDate.toLocaleTimeString()}`
                    }]
                },
            ],
            as_user: true,
        });

        if (!result.ok) respond({
            text: 'Oops, something went wrong submitting notes',
        });

        return;
    }

    next();
});

app.command('/standup', async ({ body, ack, payload, }) => {
    ack();

    await app.client.dialog.open({
        token,
        trigger_id: payload.trigger_id,
        dialog: JSON.stringify({
            "callback_id": "ryde-46e2b0", // TODO: figure out what this should be
            "title": "Submit your standup", // TODO: maybe inclue the date
            "submit_label": "Submit",
            "elements": [
                {
                    "type": "textarea",
                    "label": "What did you do yesterday?",
                    "name": labels.STANDUP_YESTERDAY
                },
                {
                    "type": "textarea",
                    "label": "What are you planning on doing tomorrow?",
                    "name": labels.STANDUP_TODAY
                }
            ]
        }),
    });
});

(async () => {
    // Start your app
    await app.start(process.env.PORT || 3000);

    console.log('⚡️ Bolt app is running!');
})();
