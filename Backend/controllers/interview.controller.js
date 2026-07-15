const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {
    console.log("req.file =", req.file);
    console.log("req.body =", req.body);
    try {
        // Check if resume file is provided
        if (!req.file) {
            return res.status(400).json({
                message: "Resume file is required. Please upload a PDF or DOCX file."
            })
        }

        const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText()
        const { selfDescription, jobDescription } = req.body

        // Validate required fields
        if (!jobDescription) {
            return res.status(400).json({
                message: "Job description is required."
            })
        }

        const interViewReportByAi = await generateInterviewReport({
            resume: resumeContent.text,
            selfDescription,
            jobDescription
        })
        console.log("AI DATA RECEIVED:");
        console.log(interViewReportByAi);

        console.log("AI Response:", interViewReportByAi)

// Use the AI response directly
const transformedReport = {
    title: interViewReportByAi.title || "Interview Report",

    matchScore: interViewReportByAi.matchScore || 0,

    technicalQuestions:
        interViewReportByAi.technicalQuestions || [],

    behavioralQuestions:
        interViewReportByAi.behavioralQuestions || [],

    skillGaps:
        interViewReportByAi.skillGaps || [],

    preparationPlan:
        interViewReportByAi.preparationPlan || []
};

console.log("Transformed Report:", transformedReport);

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            ...transformedReport
        })

        console.log("Saved Interview Report:", {
            _id: interviewReport._id,
            title: interviewReport.title,
            matchScore: interviewReport.matchScore,
            technicalQuestionsCount: interviewReport.technicalQuestions?.length || 0,
            behavioralQuestionsCount: interviewReport.behavioralQuestions?.length || 0,
            skillGapsCount: interviewReport.skillGaps?.length || 0,
            preparationPlanCount: interviewReport.preparationPlan?.length || 0
        })

        res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        })
    } catch (error) {
        console.error("Error generating interview report:", error)
        res.status(500).json({
            message: "Failed to generate interview report. Please try again.",
            error: error.message
        })
    }
}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    console.log("Fetched Interview Report:", {
        found: !!interviewReport,
        _id: interviewReport?._id,
        title: interviewReport?.title,
        matchScore: interviewReport?.matchScore,
        technicalQuestionsCount: interviewReport?.technicalQuestions?.length || 0,
        behavioralQuestionsCount: interviewReport?.behavioralQuestions?.length || 0,
        skillGapsCount: interviewReport?.skillGaps?.length || 0,
        preparationPlanCount: interviewReport?.preparationPlan?.length || 0
    })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findById(interviewReportId)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}

module.exports = { generateInterViewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController }