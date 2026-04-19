"use strict";

"use strict";

/**
 * services/conversationEngine/index.js
 *
 * 役割:
 * - 使用する会話エンジンを決定する
 * - v35 / v37 のどちらかを呼ぶ
 * - 共通返却契約（serviceResponse）を保証する
 * - 共通 data shape を保証する
 */

const { success, fail } = require("../../utils/serviceResponse");
const { runV35 } = require("../v35");
const { runV37 } = require("../v37");

function getEngineVersion(params = {}) {
  const fromParams = String(params.currentEngine || "").trim().toLowerCase();
  if (fromParams) {
    return fromParams;
  }

  return String(process.env.CONVERSATION_ENGINE_VERSION || "v35")
    .trim()
    .toLowerCase();
}

function normalizeEngineData(result = {}) {
  return {
    replyText: String(result.replyText || "").trim(),
    topicLabel: String(result.topicLabel || "【テーマ無し】").trim(),
    companyId: result.companyId || null,
    matchedCompanyId: result.matchedCompanyId || null,
    currentCompanyId: result.currentCompanyId || null,
    isConversationContinuing: Boolean(result.isConversationContinuing),
  };
}

async function runConversationEngine(params = {}) {
  try {
    const engineVersion = getEngineVersion(params);

    if (engineVersion === "off") {
      return success(
        {
          replyText: "OFFです。AI会話は停止中です。",
          topicLabel: "【OFF】",
          companyId: null,
          matchedCompanyId: null,
          currentCompanyId: null,
          isConversationContinuing: false,
        },
        "conversation engine ok: off"
      );
    }

    let rawResult = null;

    if (engineVersion === "v37") {
      rawResult = await runV37(params);
    } else {
      rawResult = await runV35(params);
    }

    /**
     * v35 / v37 が serviceResponse 契約で返す場合
     */
    if (rawResult && typeof rawResult === "object" && "success" in rawResult) {
      if (!rawResult.success) {
        return fail(
          rawResult.message || `conversation engine failed: ${engineVersion}`,
          rawResult.data || null
        );
      }

      return success(
        normalizeEngineData(rawResult.data || {}),
        rawResult.message || `conversation engine ok: ${engineVersion}`
      );
    }

    /**
     * v35 / v37 が data本体だけ返す場合
     * 初期移行期間の吸収用
     */
    return success(
      normalizeEngineData(rawResult || {}),
      `conversation engine ok: ${engineVersion}`
    );
  } catch (error) {
    return fail(
      error?.message || "runConversationEngine failed",
      null
    );
  }
}

module.exports = {
  runConversationEngine,
  normalizeEngineData,
  getEngineVersion,
};