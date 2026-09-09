import type { NextFunction, Request, Response } from 'express'

/**
 * Autenticação simples para uso pessoal (sem login/contas): compara um token fixo
 * enviado pelo frontend contra APP_ACCESS_TOKEN. Não é segurança forte (o token vai
 * embutido no build do frontend), apenas evita que bots/scanners batam na API à toa.
 * Para múltiplos usuários reais, troque por autenticação de verdade.
 */
export function requireAccessToken(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.APP_ACCESS_TOKEN
  if (!expected) {
    // Sem token configurado no ambiente: não protege (facilita rodar localmente sem setup).
    next()
    return
  }
  const header = req.header('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (token !== expected) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  next()
}
