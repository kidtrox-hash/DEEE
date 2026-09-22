export const DEFAULTS = {
  meetingDate: "2026-12-04T18:00:00",
  metDate: "2024-08-14T00:00:00",
  songUrl: "/our-song.mp3",
  songName: "Secondhand - Don Toliver ft Rema",
  videoUrl: "/our-video.mp4",
  videoName: "Secondhand - Don Toliver ft Rema",
}

export type OpenWhenLetter = {
  id: string
  title: string
  subtitle: string
  content: string
  icon: string
}

export const DEFAULT_OPEN_WHEN: OpenWhenLetter[] = [
  { id: "miss", title: "Open when you miss me", subtitle: "for the nights I feel too far", icon: "🌙", content: "Hey love,\n\nIf you're opening this, you're missing me. I am too — probably at the exact same second you're reading this.\n\nClose your eyes for a sec. Remember my laugh? The stupid way I say your name when I'm trying to be serious and fail?\n\nI'm right here. In this letter, in that corner of your room where you keep that thing I gave you, in every song you have to skip because it reminds you of us.\n\nMiss me a little more for me, okay? I'll make it up to you when I see you.\n\nYours,\nTanaka" },
  { id: "bad-day", title: "Open when you're having a bad day", subtitle: "let me fix it a little", icon: "🌧️", content: "My Diane,\n\nBad days don't suit you, but I know they come.\n\nListen — you don't have to be strong right now. Not with me. Tell me what happened, even if it's messy, even if you're crying while typing. I'll read it like it's the most important thing in the world. Because it is.\n\nYou are doing so much better than you think. I see you. I'm proud of you. Always.\n\nCome here — well, virtually — let me annoy you until you at least smile once. Deal?\n\nLove you, even on the grey days. Especially on the grey days.\nTanaka" },
  { id: "sleep", title: "Open when you can't sleep", subtitle: "2am thoughts, my favorite", icon: "✨", content: "Diane, my night owl,\n\nIt's late. You're staring at the ceiling again, aren't you?\n\nPlay this in your head: I'm lying next to you, my arm exactly where you like it, your head finding that spot on my chest. I'm playing with your hair the way that makes you sleepy. You'd complain I'm being distracting, but you wouldn't move.\n\nBreathe with me. In, out. In, out.\n\nYou are safe. You are loved. You are going to dream of something soft.\n\nText me \"I can't sleep\" anytime. I'll be your lullaby.\n\nGoodnight, beautiful.\nTanaka ❤️" },
  { id: "reminder", title: "Open when you need a little reminder", subtitle: "in case I haven't said it enough", icon: "💌", content: "Hi love,\n\nReminder, as ordered:\n\n• You are the first person I think of in the morning.\n• You make me want to be better without ever asking me to change.\n• Your laugh is my favorite sound. Yes, still.\n• I chose you. I keep choosing you. Every day.\n• We are going to have so many more days together than days apart. This wait is temporary. Us is not.\n\nKeep this one close. Open it anytime the world is loud.\n\nAlways yours,\nTanaka" },
  { id: "smile", title: "Open when you want to smile", subtitle: "warning: extremely cheesy inside", icon: "😂", content: "Okay Diane,\n\nYou want to smile? Challenge accepted.\n\nRemember when I tried to be cool and immediately tripped? Or my terrible drawings on our blackboard that you pretend are \"art\"? Or how I say \"I’m not jealous\" with the most jealous face ever?\n\nYou do that to me. You turn me into this goofy, soft person and I love it.\n\nP.S. Don't pretend you didn't just smile. I felt it through the phone. 😏❤️\n\nYour favorite dummy,\nTanaka" },
  { id: "meet", title: "Open when we finally meet ❤️", subtitle: "for that day. our day.", icon: "❤️", content: "Diane,\n\nIf you're opening this, we're there. Or about to be.\n\nAfter all those countdowns, all those \"I miss you\"s, all those nights we fell asleep on call — we made it.\n\nLook up from this phone. I'm right there. Come here.\n\nHi, love. I missed you so much.\n\nNow put this phone away and let me hold you.\n\nAll my love, finally in person,\nTanaka" },
]

export const DEFAULT_QUESTIONS = [
  "What's one small thing about us that you never want to change?",
  "Where should we go together someday, just the two of us?",
  "What's a memory with me you wish you could replay today?",
  "What's something you want us to do together this year?",
  "What's one thing about me that always makes you smile?",
  "If we could steal one whole day together, what would we do from morning to night?",
]

export const DEFAULT_NOTE_TEXTS = [
  "I was thinking about you today. Again. Obviously.",
  "You randomly crossed my mind and now I can't focus 😂",
  "I hope you know how special you are to me, Diane.",
  "Hi. Just wanted to say I love you a little extra today.",
]

export const DEFAULT_MESSAGE = `HAAAA My ego is against writting letters manje😂😂🥲🥲`

export const DEFAULT_MEMORIES: { id:string; date:string; caption:string; text:string; image:string; author:"Tanaka"|"Diane" }[] = []
