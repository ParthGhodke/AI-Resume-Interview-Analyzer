const test = require('node:test')
const assert = require('node:assert/strict')

const { buildInterviewPrompt, generateWithRetry } = require('../services/ai.service')

test('buildInterviewPrompt trims long resume and job description inputs', () => {
  const resume = 'R'.repeat(7000)
  const jobDescription = 'J'.repeat(5000)

  const prompt = buildInterviewPrompt({
    resume,
    selfDescription: 'Self description',
    jobDescription
  })

  assert.match(prompt, /Resume:\s*R{6000}/)
  assert.match(prompt, /Job Description:\s*J{4000}/)
})

test('generateWithRetry retries transient failures and resolves', async () => {
  let attempts = 0

  const result = await generateWithRetry(async () => {
    attempts += 1
    if (attempts < 3) {
      const error = new Error('503 Service Unavailable')
      error.cause = { code: 'UNAVAILABLE' }
      throw error
    }
    return 'ok'
  }, 3, 1)

  assert.equal(result, 'ok')
  assert.equal(attempts, 3)
})
