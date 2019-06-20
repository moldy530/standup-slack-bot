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
    COMMENT: 'standup_comment',
};

const dialogSubmits = {
    COMMENT: 'comment_standup',
    STANDUP: 'standup',
};

app.action(/comment_(yest|today)/, async ({ ack, body, payload, ...props }) => {
    ack();
    const { message } = body;
    const { block_id } = payload;

    const itemToComment = message.blocks.find(x => x.block_id === block_id);
    const { user: { name } } = await app.client.users.info({
        token,
        user: message.user,
    });

    await app.client.dialog.open({
        token,
        trigger_id: body.trigger_id,
        dialog: JSON.stringify({
            "callback_id": `comment-${(new Date()).toTimeString()}`,
            "title": `Comment on standup item`,
            "submit_label": "Submit",
            "state": JSON.stringify({
                type: dialogSubmits.COMMENT,
                message_ts: message.ts,
                item: itemToComment.text.text,
            }),
            "elements": [
                {
                    "type": "textarea",
                    "label": `Commenting on "${itemToComment.text.text}"`,
                    "name": labels.COMMENT,
                    "placeholder": `Leave a comment for ${name}`
                },
            ]
        })
    });

});

app.use(async ({ action, next, ack, say, respond, payload }) => {
    if (action && action.type === 'dialog_submission') {
        ack();

        const { submission, state } = action;

        const jsonState = JSON.parse(state);

        switch (jsonState.type) {
            case 'standup':
                await handleStandupSubmission({ submission, respond, payload });
                return;
            case 'comment_standup':
                await handleStandupComment({ submission, respond, payload, state: jsonState });
                return;
            default:
                return;
        }
    }

    next();
});

app.command('/standup', async ({ body, ack, payload }) => {
    ack();

    await app.client.dialog.open({
        token,
        trigger_id: payload.trigger_id,
        dialog: JSON.stringify({
            "callback_id": `standup-${(new Date()).toTimeString()}`,
            "title": "Submit your standup",
            "submit_label": "Submit",
            "state": JSON.stringify({
                type: dialogSubmits.STANDUP
            }),
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

const handleStandupComment = async ({ submission, respond, payload, state }) => {
    const cleanedUpItem = state.item.replace(/^(\s*)-(\s*)/, '');

    await app.client.chat.postMessage({
        token: oauthToken,
        channel: payload.channel.id,
        thread_ts: state.message_ts,
        blocks: [{
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `> ${cleanedUpItem}\n\n${submission[labels.COMMENT]}`
            }
        }],
        as_user: true,
    })
};

const handleStandupSubmission = async ({ submission, respond, payload }) => {
    const submittedDate = new Date();
    const filterSubmission = sub => sub.split(/\n+/).filter(x => /\S/.test(x));

    const yesterdayLineItems = filterSubmission(submission[labels.STANDUP_YESTERDAY]).map((item, idx) => ({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: item,
        },
        accessory: {
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": "Comment"
            },
            "value": `comment_yest_${idx}`,
            "action_id": "comment_yest"
        }
    }));

    const todayLineItems = filterSubmission(submission[labels.STANDUP_TODAY]).map((item, idx) => ({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: item,
        },
        accessory: {
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": "Comment"
            },
            "value": `comment_today_${idx}`,
            "action_id": "comment_today"
        }
    }));

    const result = await app.client.chat.postMessage({
        token: oauthToken, // TODO: this might not be right
        channel: payload.channel.id,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*What I did yesterday:*`
                }
            },
            ...yesterdayLineItems,
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*What I'm doing today:*`,
                },
            },
            ...todayLineItems,
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
};

(async () => {
    // Start your app
    await app.start(process.env.PORT || 3000);

    console.log('⚡️ Bolt app is running!');
})();
