import { NextResponse } from "next/server";
import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import {
  AI_PROVIDERS,
  getProviderAlias,
} from "@/shared/constants/providers";
import { getProviderConnections, getCombos, getCustomModels } from "@/lib/localDb";
import { getDisabledModels } from "@/lib/disabledModelsDb";

export const dynamic = "force-dynamic";

const LLM_KIND = "llm";
const MODEL_TYPE_TO_KIND = {
  image: "image",
  tts: "tts",
  embedding: "embedding",
  stt: "stt",
  imageToText: "imageToText",
};

function modelKind(model) {
  if (!model?.type) return LLM_KIND;
  return MODEL_TYPE_TO_KIND[model.type] || LLM_KIND;
}

function providerMatchesKind(providerId, kind) {
  const provider = AI_PROVIDERS[providerId];
  if (!provider) return kind === LLM_KIND;
  const kinds = provider.serviceKinds;
  return Array.isArray(kinds) ? kinds.includes(kind) : kind === LLM_KIND;
}

function comboMatchesKind(combo, kind) {
  return (combo?.kind || LLM_KIND) === kind;
}

function modelEntry(id, ownedBy) {
  return { id, object: "model", owned_by: ownedBy };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") || LLM_KIND;

  try {
    const combos = await getCombos().catch(() => []);
    const firstCombo = (combos || []).find((combo) => comboMatchesKind(combo, kind));
    if (firstCombo?.name) {
      return NextResponse.json({ model: modelEntry(firstCombo.name, "combo"), source: "combo" });
    }

    const disabledByAlias = await getDisabledModels().catch(() => ({}));
    const isDisabled = (alias, modelId) => Array.isArray(disabledByAlias[alias]) && disabledByAlias[alias].includes(modelId);

    let connections = await getProviderConnections().catch(() => []);
    connections = (connections || [])
      .filter((conn) => conn.isActive !== false)
      .sort((a, b) => (a.priority || 9999) - (b.priority || 9999));

    const connectedProviderIds = new Set(connections.map((conn) => conn.provider));
    for (const [providerId, providerInfo] of Object.entries(AI_PROVIDERS)) {
      if (providerInfo.noAuth && !connectedProviderIds.has(providerId)) {
        connections.push({
          id: `implicit-${providerId}`,
          provider: providerId,
          isActive: true,
          authType: "none",
          providerSpecificData: {},
        });
      }
    }

    const customModels = await getCustomModels().catch(() => []);

    for (const conn of connections) {
      const providerId = conn.provider;
      if (!providerMatchesKind(providerId, kind)) continue;

      const staticAlias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
      const outputAlias = (
        conn?.providerSpecificData?.prefix ||
        getProviderAlias(providerId) ||
        staticAlias
      ).trim();
      const providerModels = PROVIDER_MODELS[staticAlias] || [];
      const enabledModels = conn?.providerSpecificData?.enabledModels;
      const rawModelIds = Array.isArray(enabledModels) && enabledModels.length > 0
        ? enabledModels
        : providerModels.filter((model) => modelKind(model) === kind).map((model) => model.id);

      const firstModelId = rawModelIds
        .map((modelId) => {
          if (typeof modelId !== "string") return "";
          if (modelId.startsWith(`${outputAlias}/`)) return modelId.slice(outputAlias.length + 1);
          if (modelId.startsWith(`${staticAlias}/`)) return modelId.slice(staticAlias.length + 1);
          if (modelId.startsWith(`${providerId}/`)) return modelId.slice(providerId.length + 1);
          return modelId;
        })
        .find((modelId) => modelId && !isDisabled(outputAlias, modelId) && !isDisabled(staticAlias, modelId));

      if (firstModelId) {
        return NextResponse.json({ model: modelEntry(`${outputAlias}/${firstModelId}`, outputAlias), source: "provider" });
      }

      const custom = (customModels || []).find((m) => {
        if (!m?.id || (m.type && m.type !== kind)) return false;
        return m.providerAlias === outputAlias || m.providerAlias === staticAlias || m.providerAlias === providerId;
      });
      if (custom?.id) {
        return NextResponse.json({ model: modelEntry(`${outputAlias}/${custom.id}`, outputAlias), source: "custom" });
      }
    }

    return NextResponse.json({ model: null, source: "none" });
  } catch (error) {
    console.log("Error fetching default model:", error);
    return NextResponse.json({ error: "Failed to fetch default model" }, { status: 500 });
  }
}
