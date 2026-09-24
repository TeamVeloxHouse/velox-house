import type { Conversation, CommsMessage, CommsChannel } from './types'

// Demo conversations for the unified inbox — homeowners at every stage of the Solar House journey,
// reaching us on every channel. Times are relative to first load so the inbox always looks live.
const MIN = 60_000
const ago = (mins: number) => Date.now() - mins * MIN
let n = 0
const m = (channel: CommsChannel, dir: CommsMessage['dir'], author: string, body: string, minsAgo: number, extra: Partial<CommsMessage> = {}): CommsMessage =>
  ({ id: `cm${++n}`, channel, dir, author, body, at: ago(minsAgo), ...extra })

export function buildConversations(): Conversation[] {
  n = 0
  return [
    {
      id: 'cv1', name: 'Sarah Whitfield', phone: '+44 7700 900412', email: 'sarah.whitfield@gmail.com', address: '14 Hatherley Road, Cheltenham GL51 6EW',
      stage: 'quoted', source: 'Cheltenham showroom', assignee: 'Jordan Miles', status: 'open', unread: true, starred: true, valueHint: 14200,
      messages: [
        m('email', 'out', 'Jordan Miles', 'Hi Sarah,\n\nLovely to meet you both at the showroom on Saturday. As promised, attached is your proposal for a 5.2 kWp system with a 10 kWh battery.\n\nEstimated first-year saving is £1,180 and the payback is just under 11 years. Any questions at all, just shout.\n\nBest,\nJordan', 2880, { subject: 'Your Solar House proposal — 14 Hatherley Road' }),
        m('email', 'in', 'Sarah Whitfield', 'Hi Jordan,\n\nThanks so much for this, it all makes sense. Two quick questions before we decide:\n\n1. Would the battery still work in a power cut?\n2. Our neighbour got a quote with 12 panels rather than your 12 + a larger inverter, is that a big difference?\n\nWe\'d love to get this booked before Christmas if we can.\n\nSarah', 95, { subject: 'Re: Your Solar House proposal — 14 Hatherley Road' }),
        m('whatsapp', 'in', 'Sarah Whitfield', 'Just sent you an email 😊 mainly wondering about the power cut thing, my husband is keen on backup', 40),
      ],
    },
    {
      id: 'cv2', name: 'Gareth Morgan', phone: '+44 7700 900871', address: '3 Heol Y Forlan, Cardiff CF14 1AY',
      stage: 'new-lead', source: 'Facebook lead ad', status: 'open', unread: true, valueHint: 11800,
      messages: [
        m('web', 'in', 'Facebook lead form', 'Name: Gareth Morgan\nPhone: 07700 900871\nPostcode: CF14 1AY\nInterested in: Solar + battery\nMonthly electricity bill: £180–£220\nBest time to call: Evenings', 22),
        m('call', 'in', 'Gareth Morgan', 'Missed call', 12, { callSecs: 0, voicemail: 'Hi, it’s Gareth, I filled in the form on Facebook about the solar panels. I’m around after six if someone could give me a ring. Cheers.' }),
      ],
    },
    {
      id: 'cv3', name: 'Priya Shah', phone: '+44 7700 900233', email: 'priya.shah@outlook.com', address: '27 Lansdown Crescent, Cheltenham GL50 2LD',
      stage: 'survey', source: 'Website enquiry', assignee: 'Amy Price', status: 'open', unread: false, valueHint: 16900,
      messages: [
        m('sms', 'out', 'Amy Price', 'Hi Priya, it’s Amy from The Solar House. Just confirming your home survey this Thursday at 10am with our surveyor Rhys. Reply YES to confirm or call 01242 502010 to rearrange.', 1500),
        m('sms', 'in', 'Priya Shah', 'YES confirmed thanks. Is it ok that we have a conservatory on the south side? Not sure if that affects anything', 1440),
        m('sms', 'note', 'Amy Price', 'Conservatory on the south elevation — flag to Rhys, may shade the lower rows. Listed-building check needed (Lansdown Crescent).', 1430),
        m('sms', 'out', 'Amy Price', 'Totally fine! Rhys will take a look on the day and factor it in. See you Thursday 👍', 1425),
      ],
    },
    {
      id: 'cv4', name: 'David & Helen Price', phone: '+44 7700 900654', email: 'dhprice@btinternet.com', address: '9 Semington Road, Melksham SN12 6DL',
      stage: 'installing', source: 'Melksham showroom', assignee: 'Rhys Evans', status: 'open', unread: true, valueHint: 13400,
      messages: [
        m('portal', 'in', 'Helen Price', 'Hi, the scaffolders have just arrived but nobody told us they were coming today? We thought installation was next Tuesday. Is everything ok?', 18),
        m('call', 'out', 'Rhys Evans', 'Outbound call', 10, { callSecs: 214 }),
        m('sms', 'note', 'Rhys Evans', 'Scaffold booked a week early by the sub-contractor. Helen fine with it staying up — install still Tue. Need to fix the scaffold notification on the portal.', 8),
      ],
    },
    {
      id: 'cv5', name: 'Tom Richards', phone: '+44 7700 900119', address: '41 Whitchurch Road, Cardiff CF14 3JN',
      stage: 'assessment', source: 'Instagram', status: 'open', unread: true, valueHint: 9800,
      messages: [
        m('social', 'in', 'Tom Richards (Instagram)', 'Saw your reel about the battery-only install 👀 we already have 8 panels from 2014, can we just add a battery?', 65),
      ],
    },
    {
      id: 'cv6', name: 'Margaret Allen', phone: '+44 7700 900782', email: 'm.allen1952@gmail.com', address: '5 The Paddocks, Charlton Kings, Cheltenham GL53 8DW',
      stage: 'customer', source: 'Referral', assignee: 'Jordan Miles', status: 'open', unread: false, valueHint: 0,
      messages: [
        m('portal', 'in', 'Margaret Allen', 'The app says the battery is at 100% but the house is still using the grid in the evening. Have I done something wrong?', 300),
        m('portal', 'out', 'Jordan Miles', 'Hi Margaret, you haven’t done anything wrong at all! The battery is set to hold charge for backup. I’ll ask our team to switch it to self-use mode remotely this afternoon. You won’t need to do anything.', 280),
        m('portal', 'in', 'Margaret Allen', 'Thank you so much, you have all been wonderful. My friend Joan on Cirencester Road is interested too, can I pass on your number?', 30),
      ],
    },
    {
      id: 'cv7', name: 'Owen Jenkins', phone: '+44 7700 900345', email: 'owen.j@icloud.com', address: '18 Cyncoed Road, Cardiff CF23 5SB',
      stage: 'quoted', source: 'Cardiff showroom', assignee: 'Amy Price', status: 'open', unread: false, valueHint: 18500,
      messages: [
        m('email', 'out', 'Amy Price', 'Hi Owen,\n\nFollowing your visit, here is the revised quote including the 7 kW EV charger you asked about. The whole-home package comes to £18,500 with 0% finance over 5 years available.\n\nThanks,\nAmy', 4320, { subject: 'Revised quote — solar, battery & EV charger' }),
        m('email', 'in', 'Owen Jenkins', 'Thanks Amy. We\'re comparing with one other installer who is about £1,400 cheaper. What makes yours worth the extra?', 2600, { subject: 'Re: Revised quote — solar, battery & EV charger' }),
      ],
    },
    {
      id: 'cv8', name: 'Lucy Bennett', phone: '+44 7700 900567', address: '72 Innsworth Lane, Gloucester GL2 0DF',
      stage: 'new-lead', source: 'Website enquiry', status: 'open', unread: true, valueHint: 10500,
      messages: [
        m('web', 'in', 'Website — Get Solar Quote', 'Name: Lucy Bennett\nPhone: 07700 900567\nPostcode: GL2 0DF\nRoof faces: South-west\nMessage: We have an electric car and want to charge it from solar. Is it worth it for a semi-detached?', 150),
        m('whatsapp', 'out', 'Ovi (auto)', 'Hi Lucy, thanks for your enquiry with The Solar House ☀️ One of the team will call you today. In the meantime, can you share a photo of your latest electricity bill? It helps us give you an accurate saving.', 149),
        m('whatsapp', 'in', 'Lucy Bennett', '📎 bill-august.jpg — here you go! Around 4,800 kWh a year', 120),
      ],
    },
    {
      id: 'cv9', name: 'Chris Hollis', phone: '+44 7700 900998', email: 'chris.hollis@hotmail.co.uk', address: '11 Spa Road, Melksham SN12 7NS',
      stage: 'survey', source: 'Google search', assignee: 'Rhys Evans', status: 'snoozed', unread: false, valueHint: 12700,
      messages: [
        m('email', 'in', 'Chris Hollis', 'Hi, I need to move the survey — something has come up at work. Any chance of the week after next?', 5000, { subject: 'Survey date' }),
        m('email', 'out', 'Rhys Evans', 'No problem Chris, I\'ve pencilled you in for Wednesday the 8th at 2pm. I\'ll text the day before to confirm.', 4900, { subject: 'Re: Survey date' }),
      ],
    },
    {
      id: 'cv10', name: 'Emma Clarke', phone: '+44 7700 900432', email: 'emmaclarke@gmail.com', address: '2 Rowan Close, Gloucester GL3 4PG',
      stage: 'customer', source: 'Gloucester showroom', assignee: 'Jordan Miles', status: 'done', unread: false, valueHint: 0,
      messages: [
        m('email', 'in', 'Emma Clarke', 'Just wanted to say thank you — the install team were brilliant and so tidy. We generated 28 kWh yesterday!', 9000, { subject: 'Thank you!' }),
        m('email', 'out', 'Jordan Miles', 'That\'s wonderful to hear Emma, thank you! If you have 2 minutes, a Google review would mean the world to the team: https://g.page/r/thesolarhouse/review', 8900, { subject: 'Re: Thank you!' }),
      ],
    },
  ]
}
