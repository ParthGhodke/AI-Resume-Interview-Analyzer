require("dotenv").config();
const Groq = require("groq-sdk");
const { z } = require("zod");
const puppeteer = require("puppeteer");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const MODEL = "llama-3.3-70b-versatile";

console.log("Using Groq Model:", MODEL);

const MAX_RESUME_LENGTH = 6000;
const MAX_JOB_DESCRIPTION_LENGTH = 4000;

function trimText(text = "", maxLength = 4000) {
    if (!text) return "";
    return text.length > maxLength
        ? text.substring(0, maxLength)
        : text;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry Gemini API on temporary failures.
 */
async function generateWithRetry(messages, schema) {

    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {

        try {

            console.log(`Groq Request Attempt ${attempt}/3`);

            const completion = await groq.chat.completions.create({
                model: MODEL,
                temperature: 0.1 ,
                response_format: {
                    type: "json_object"
                },
                messages
            });

            const content = completion.choices[0].message.content;

            const parsed = JSON.parse(content);

            const validated = schema.parse(parsed);

            return validated;

        } catch (err) {

            lastError = err;

            console.log("Groq Error:", err.message);

            if (attempt < 3) {
                console.log(`Retrying in ${attempt * 3} seconds...`);
                await sleep(attempt * 3000);
            }

        }

    }

    throw lastError;
}
/**
 * ----------------------------
 * Interview Report Schema
 * ----------------------------
 */

const interviewReportSchema = z.object({

    title: z.string(),

    matchScore: z.number().min(0).max(100),

    technicalQuestions: z.array(
    z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string()
    })
    ).length(10),

    behavioralQuestions: z.array(
    z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string()
    })
    ).length(10),

    skillGaps: z.array(
    z.object({
        skill: z.string(),
        severity: z.enum(["low","medium","high"])
    })
    ).length(8),

    preparationPlan: z.array(
    z.object({
        day: z.number(),
        focus: z.string(),
        tasks: z.array(z.string()).min(4).max(4)
    })
    ).length(7),

});


/**
 * ----------------------------
 * Resume PDF Schema
 * ----------------------------
 */

const resumePdfSchema = z.object({

    html: z.string()

});
/**
 * Generate Interview Report
 */
async function generateInterviewReport({
    resume,
    selfDescription,
    jobDescription,
}) {

    console.log("Generating Interview Report...");

    resume = trimText(resume, MAX_RESUME_LENGTH);
    jobDescription = trimText(jobDescription, MAX_JOB_DESCRIPTION_LENGTH);

    const prompt = `
You are an expert Technical Interviewer, HR Manager, and Career Coach.

Analyze the candidate resume and the job description very carefully.

Return ONLY valid JSON.

IMPORTANT RULES:

1. Match score must be between 0 and 100.

2. Generate EXACTLY:

- 10 technicalQuestions
- 10 behavioralQuestions
- 8 skillGaps
- 7 preparationPlan days

3. NEVER leave any array empty.

4. If candidate lacks experience, mention it as a skill gap.

5. Compare every important skill in the Job Description with the Resume.

6. If any required skill is missing, include it in skillGaps.

7. Every preparation day must contain exactly 4 tasks.

8. Questions must be realistic interview questions.

9. Answers should be detailed.

Candidate Resume:

${resume}

Candidate Self Description:

${selfDescription}

Job Description:

${jobDescription}

Return JSON in this exact format:

{
  "matchScore": number,
  "technicalQuestions": [
    {
      "question": "...",
      "intention": "...",
      "answer": "..."
    }
  ],
  "behavioralQuestions": [
    {
      "question": "...",
      "intention": "...",
      "answer": "..."
    }
  ],
  "skillGaps": [
    {
      "skill": "...",
      "severity": "low | medium | high"
    }
  ],
  "preparationPlan": [
    {
      "day": 1,
      "focus": "...",
      "tasks": [
        "...",
        "...",
        "...",
        "..."
      ]
    }
  ],
  "title": "Job Title"
}
`;
const messages = [

    {
        role: "system",
        content:
`You are a senior HR Manager, Technical Interviewer and ATS Resume Reviewer.

Your job is to compare the resume against the job description.

You MUST return ONLY valid JSON.

Do not use markdown.

Do not wrap JSON inside code blocks.

Never omit fields.

Never return empty arrays.

Always return every field requested.`
    },

    {
        role: "user",
        content: prompt
    }

];

const report = await generateWithRetry(
    messages,
    interviewReportSchema
);

    // Ensure arrays always exist
    report.technicalQuestions = report.technicalQuestions || [];
    report.behavioralQuestions = report.behavioralQuestions || [];
    report.skillGaps = report.skillGaps || [];
    report.preparationPlan = report.preparationPlan || [];

    return report;
}
/**
 * ---------------------------------------
 * Generate PDF from HTML
 * ---------------------------------------
 */
async function generatePdfFromHtml(htmlContent) {

    console.log("Launching Puppeteer...");

    const browser = await puppeteer.launch({
        headless: true
    });

    try {

        const page = await browser.newPage();

        await page.setContent(htmlContent, {
            waitUntil: "networkidle0"
        });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm"
            }
        });

        return pdfBuffer;

    } finally {

        await browser.close();

    }

}


/**
 * ---------------------------------------
 * Generate Resume PDF
 * ---------------------------------------
 */

async function generateResumePdf({
    resume,
    selfDescription,
    jobDescription
}) {

    console.log("Generating Resume PDF...");

    resume = trimText(resume, MAX_RESUME_LENGTH);
    jobDescription = trimText(jobDescription, MAX_JOB_DESCRIPTION_LENGTH);
    selfDescription = trimText(selfDescription, 1500);

    const resumePdfSchema = z.object({
        html: z.string()
    });

    const messages = [

        {
            role: "system",
            content:
`You are an expert resume writer.

Return ONLY valid JSON.

Return this format:

{
  "html":"..."
}

Generate a professional ATS-friendly HTML resume.

Rules:

- Modern design
- White background
- Professional fonts
- Good spacing
- One page if possible
- Tailor resume to job description
- No markdown
- No explanations
- Return only JSON.`
        },

        {
            role: "user",
            content:
`Resume:

${resume}

Self Description:

${selfDescription}

Job Description:

${jobDescription}`
        }

    ];

    const json = await generateWithRetry(
        messages,
        resumePdfSchema
    );

    const pdfBuffer = await generatePdfFromHtml(
        json.html
    );

    return pdfBuffer;

}


/**
 * ---------------------------------------
 * Exports
 * ---------------------------------------
 */

module.exports = {

    generateInterviewReport,

    generateResumePdf

};