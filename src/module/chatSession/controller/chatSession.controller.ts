import prisma from "../../../config/prisma.js";
import { asyncHandler } from "../../../middleware/error.middleware.js";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.utils.js";
import { statusCode } from "../../../types/types.js";
import { sendMessageSchema } from "../validation/chatSession.validation.js";
import type { AuthenticatedRequest } from "../../../middleware/auth.middleware.js";

// Get active session for user
export const getMyActiveSession = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const userId = req.user?.id;
  const sessionId = req.query.sessionId as string;

  let session;

  if (userId) {
    session = await prisma.chatSession.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { messages: { orderBy: { createdAt: "asc" } } }
    });
  } else if (sessionId) {
    session = await prisma.chatSession.findFirst({
      where: { id: sessionId, status: "ACTIVE" },
      include: { messages: { orderBy: { createdAt: "asc" } } }
    });
  }

  if (!session) {
    // Return empty if no active session, frontend will create one upon first message
    return SuccessResponse(res, "No active session", null, statusCode.OK);
  }

  return SuccessResponse(res, "Active session retrieved", session, statusCode.OK);
});

// Send message (User -> Agent)
export const sendMessage = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const userId = req.user?.id;

  const validData = sendMessageSchema.parse(req.body);
  const { text, sessionId } = validData;

  let session;

  if (sessionId) {
    session = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new ErrorResponse("Session not found", statusCode.Not_Found);
    }

    if (session.userId && session.userId !== userId) {
      throw new ErrorResponse("Not authorized for this session", statusCode.Forbidden);
    }

    if (session.status === "CLOSED") {
      throw new ErrorResponse("Session is closed", statusCode.Bad_Request);
    }
  } else {
    // Create new session if no sessionId provided
    if (userId) {
      session = await prisma.chatSession.findFirst({
        where: { userId, status: "ACTIVE" }
      });
    }

    if (!session) {
      session = await prisma.chatSession.create({
        data: {
          userId: userId || null,
          status: "ACTIVE"
        }
      });
    }
  }

  // Create message
  const message = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      sender: "USER",
      text
    }
  });

  return SuccessResponse(res, "Message sent successfully", message, statusCode.Created);
});

// Get all sessions (Admin / Agent)
export const getAllSessions = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const sessions = await prisma.chatSession.findMany({
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      messages: {
        orderBy: {
          createdAt: "asc" // We want chronological order for the chat UI
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return SuccessResponse(res, "Sessions retrieved successfully", sessions, statusCode.OK);
});

// Send agent reply (Agent -> User)
export const sendAgentReply = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const { id: sessionId } = req.params;
  const validData = sendMessageSchema.parse(req.body);
  const { text } = validData;

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new ErrorResponse("Session not found", statusCode.Not_Found);
  }

  if (session.status === "CLOSED") {
    throw new ErrorResponse("Session is closed", statusCode.Bad_Request);
  }

  const message = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      sender: "AGENT",
      text
    }
  });

  return SuccessResponse(res, "Agent reply sent successfully", message, statusCode.Created);
});

// Close Session (Agent or User)
export const closeSession = asyncHandler<AuthenticatedRequest>(async (req, res, next) => {
  const { id: sessionId } = req.params;

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new ErrorResponse("Session not found", statusCode.Not_Found);
  }

  const updatedSession = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { status: "CLOSED" }
  });

  return SuccessResponse(res, "Session closed successfully", updatedSession, statusCode.OK);
});
