require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const API_PROVIDER = GROQ_API_KEY ? 'groq' : 'ollama';

// ─── AI Helper Functions ───────────────────────────────────────────────────
async function generateAIResponse(prompt, systemPrompt, stream = false, model = 'llama3-8b-8192') {
  if (API_PROVIDER === 'groq') {
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model === 'llama3' ? 'llama3-8b-8192' : model, // Fallback if user passes llama3
        messages: messages,
        stream: stream,
        temperature: 0.7
      })
    });
    return response;
  } else {
    // Default to Ollama
    const body = {
      model: model,
      prompt: systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}\n\nIronAI:` : prompt,
      stream: stream
    };
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return response;
  }
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'IronMind API running' });
});

// ─── Ollama Status ───────────────────────────────────────────────────────────
app.get('/api/ollama/status', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { timeout: 3000 });
    const data = await response.json();
    const models = data.models || [];
    res.json({ online: true, models: models.map(m => m.name) });
  } catch (e) {
    res.json({ online: false, models: [], error: e.message });
  }
});

// ─── AI Chat (Ollama/Groq) ────────────────────────────────────────────────────
app.post('/api/ai/chat', async (req, res) => {
  const { message, context, model } = req.body;
  const selectedModel = model || (API_PROVIDER === 'groq' ? 'llama3-8b-8192' : 'llama3');

  const systemPrompt = `You are IronAI, an expert personal fitness coach and gym trainer built into IronMind app.
You help users with:
- Personalized workout plans based on their fitness level and goals
- Exercise form tips and injury prevention
- Nutrition and recovery advice
- Motivation and mental coaching
- Progress analysis and next steps

User context: ${JSON.stringify(context || {})}

Be concise, practical, and motivating. Format responses with emojis for readability.
Always give specific, actionable advice. Never give vague answers.`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const response = await generateAIResponse(message, systemPrompt, true, selectedModel);

    if (API_PROVIDER === 'groq') {
      const reader = response.body;
      let buffer = '';
      reader.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') {
               res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
               res.end();
               return;
            }
            try {
              const json = JSON.parse(jsonStr);
              const token = json.choices[0].delta.content;
              if (token) {
                res.write(`data: ${JSON.stringify({ token: token })}\n\n`);
              }
            } catch (e) {}
          }
        }
      });
    } else {
      const reader = response.body;
      let buffer = '';
      reader.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.trim()) {
            try {
              const json = JSON.parse(line);
              if (json.response) {
                res.write(`data: ${JSON.stringify({ token: json.response, done: json.done })}\n\n`);
              }
              if (json.done) {
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                res.end();
              }
            } catch (e) { /* skip malformed */ }
          }
        }
      });
    }

    response.body.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
      res.end();
    });

  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: `${API_PROVIDER === 'groq' ? 'Cloud AI' : 'Ollama'} not reachable.`, done: true })}\n\n`);
    res.end();
  }
});

// ─── AI Workout Generator ────────────────────────────────────────────────────
app.post('/api/ai/generate-workout', async (req, res) => {
  const { fitnessLevel, goals, muscleGroups, duration, model } = req.body;
  const selectedModel = model || (API_PROVIDER === 'groq' ? 'llama3-8b-8192' : 'llama3');

  const prompt = `You are an expert fitness coach. Generate a complete gym workout plan.

User Details:
- Fitness Level: ${fitnessLevel || 'Beginner'}
- Goals: ${goals || 'General Fitness'}
- Target Muscle Groups: ${muscleGroups || 'Full Body'}
- Session Duration: ${duration || 45} minutes

Respond with ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "workoutName": "Name of Workout",
  "totalDuration": 45,
  "warmup": [{"name": "Exercise", "duration": "5 min", "description": "How to do it"}],
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": 3,
      "reps": "10-12",
      "rest": "60 sec",
      "muscleGroup": "Chest",
      "tips": "Form tip"
    }
  ],
  "cooldown": [{"name": "Stretch", "duration": "2 min", "description": "How to do it"}],
  "estimatedCalories": 350,
  "difficulty": "Beginner"
}`;

  try {
    const response = await generateAIResponse(prompt, null, false, selectedModel);
    const data = await response.json();
    let rawText = '';
    
    if (API_PROVIDER === 'groq') {
       rawText = data.choices[0].message.content;
    } else {
       rawText = data.response || '';
    }

    // Extract JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const workout = JSON.parse(jsonMatch[0]);
      res.json({ success: true, workout });
    } else {
      throw new Error('Could not parse workout JSON');
    }
  } catch (error) {
    res.json({
      success: true,
      workout: getFallbackWorkout(fitnessLevel, muscleGroups),
      fallback: true
    });
  }
});

// ─── AI Progress Analysis ────────────────────────────────────────────────────
app.post('/api/ai/analyze-progress', async (req, res) => {
  const { workoutsCompleted, streak, totalCalories, favoriteExercises, model } = req.body;
  const selectedModel = model || (API_PROVIDER === 'groq' ? 'llama3-8b-8192' : 'llama3');

  const prompt = `As a fitness coach, analyze this user's gym progress and give personalized advice.

Stats:
- Workouts completed: ${workoutsCompleted}
- Current streak: ${streak} days
- Total calories burned: ${totalCalories}
- Favorite exercises: ${favoriteExercises}

Give a 3-4 sentence motivational analysis with specific next steps. Include 2-3 actionable recommendations. Use emojis. Be encouraging.`;

  try {
    const response = await generateAIResponse(prompt, null, false, selectedModel);
    const data = await response.json();
    let analysis = '';

    if (API_PROVIDER === 'groq') {
       analysis = data.choices[0].message.content;
    } else {
       analysis = data.response || "Keep pushing — consistency is key! 💪";
    }

    res.json({ success: true, analysis });
  } catch (error) {
    res.json({ success: true, analysis: "Great work staying consistent! 💪 Keep pushing your limits and tracking your progress. Try increasing weights by 5% this week!" });
  }
});

// ─── Fallback workout ────────────────────────────────────────────────────────
function getFallbackWorkout(level, muscles) {
  return {
    workoutName: `${muscles || 'Full Body'} Power Session`,
    totalDuration: 45,
    warmup: [
      { name: "Jump Rope", duration: "3 min", description: "Light cardio to raise heart rate" },
      { name: "Arm Circles", duration: "1 min", description: "10 forward, 10 backward each arm" },
      { name: "Leg Swings", duration: "1 min", description: "10 each leg, hold wall for balance" }
    ],
    exercises: [
      { name: "Barbell Bench Press", sets: 4, reps: "8-10", rest: "90 sec", muscleGroup: "Chest", tips: "Keep feet flat, arch natural" },
      { name: "Incline Dumbbell Press", sets: 3, reps: "10-12", rest: "75 sec", muscleGroup: "Chest", tips: "Control the descent, 2 seconds down" },
      { name: "Cable Flyes", sets: 3, reps: "12-15", rest: "60 sec", muscleGroup: "Chest", tips: "Squeeze at the peak of contraction" },
      { name: "Tricep Pushdowns", sets: 3, reps: "12-15", rest: "60 sec", muscleGroup: "Triceps", tips: "Elbows fixed at sides" },
      { name: "Overhead Tricep Extension", sets: 3, reps: "10-12", rest: "60 sec", muscleGroup: "Triceps", tips: "Keep elbows pointing forward" }
    ],
    cooldown: [
      { name: "Chest Stretch", duration: "2 min", description: "Hold doorframe, lean forward gently" },
      { name: "Tricep Stretch", duration: "1 min", description: "Pull elbow across body, hold 30 sec each" },
      { name: "Deep Breathing", duration: "2 min", description: "4 counts in, 6 counts out" }
    ],
    estimatedCalories: 380,
    difficulty: level || "Intermediate"
  };
}

// ─── Serve app ───────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🏋️  IronMind is running!`);
  console.log(`📱  App:  http://localhost:${PORT}`);
  console.log(`🤖  AI:   ${API_PROVIDER === 'groq' ? 'Groq Cloud' : 'Ollama Local'}`);
  if (API_PROVIDER === 'ollama') {
    console.log(`\nMake sure Ollama is running: ollama serve`);
    console.log(`Make sure a model is pulled:  ollama pull llama3\n`);
  } else {
    console.log(`\nUsing Groq Cloud API for AI features.\n`);
  }
});
