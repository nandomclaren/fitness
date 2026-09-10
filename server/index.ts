import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { requireAccessToken } from './auth.ts'
import { sessionsRouter } from './routes/sessions.ts'
import { goalsRouter } from './routes/goals.ts'
import { routineRouter } from './routes/routine.ts'
import { coachRouter } from './routes/coach.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '..', 'dist')

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api', requireAccessToken, sessionsRouter)
app.use('/api', requireAccessToken, goalsRouter)
app.use('/api', requireAccessToken, routineRouter)
app.use('/api', requireAccessToken, coachRouter)

// Em produção, o mesmo servidor serve o build estático do frontend (SPA).
app.use(express.static(distDir))
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next()
    return
  }
  res.sendFile(path.join(distDir, 'index.html'))
})

const port = Number(process.env.PORT) || 3001
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`)
})
