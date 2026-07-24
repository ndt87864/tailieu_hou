"use client";

import { useProfileSettings } from "./hooks/useProfileSettings";
import TabNav from "./components/TabNav";
import AppearanceTab from "./components/AppearanceTab";
import DataTab from "./components/DataTab";
import SecurityTab from "./components/SecurityTab";
import RoutingTab from "./components/RoutingTab";
import NetworkTab from "./components/NetworkTab";

export default function ProfilePage() {
  const {
    activeTab,
    setActiveTab,
    settings,
    loading,
    passwords,
    setPasswords,
    passStatus,
    passLoading,
    handlePasswordChange,
    dbLoading,
    dbStatus,
    dbAuth,
    setDbAuth,
    handleDbAuthConfirm,
    handleImportDatabase,
    oidcForm,
    updateOidcForm,
    oidcClientSecret,
    setOidcClientSecret,
    oidcStatus,
    oidcLoading,
    oidcTestLoading,
    oidcTestStatus,
    oidcRedirectUri,
    oidcExpanded,
    setOidcExpanded,
    saveOidcSettings,
    testOidcConnection,
    proxyForm,
    setProxyForm,
    proxyStatus,
    proxyLoading,
    proxyTestLoading,
    updateOutboundProxy,
    testOutboundProxy,
    updateOutboundProxyEnabled,
    updateFallbackStrategy,
    updateComboStrategy,
    updateStickyLimit,
    updateComboStickyLimit,
    updateRequireLogin,
    observabilityEnabled,
    updateObservabilityEnabled,
    handleLogout,
  } = useProfileSettings();

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6">
      <TabNav activeTab={activeTab} onChangeTab={setActiveTab} />

      {activeTab === "appearance" && (
        <AppearanceTab handleLogout={handleLogout} />
      )}

      {activeTab === "data" && (
        <DataTab
          dbLoading={dbLoading}
          dbStatus={dbStatus}
          dbAuth={dbAuth}
          setDbAuth={setDbAuth}
          handleDbAuthConfirm={handleDbAuthConfirm}
          handleImportDatabase={handleImportDatabase}
        />
      )}

      {activeTab === "security" && (
        <SecurityTab
          settings={settings}
          loading={loading}
          updateRequireLogin={updateRequireLogin}
          passwords={passwords}
          setPasswords={setPasswords}
          handlePasswordChange={handlePasswordChange}
          passLoading={passLoading}
          passStatus={passStatus}
          oidcForm={oidcForm}
          updateOidcForm={updateOidcForm}
          oidcClientSecret={oidcClientSecret}
          setOidcClientSecret={setOidcClientSecret}
          oidcExpanded={oidcExpanded}
          setOidcExpanded={setOidcExpanded}
          saveOidcSettings={saveOidcSettings}
          testOidcConnection={testOidcConnection}
          oidcLoading={oidcLoading}
          oidcTestLoading={oidcTestLoading}
          oidcStatus={oidcStatus}
          oidcTestStatus={oidcTestStatus}
          oidcRedirectUri={oidcRedirectUri}
        />
      )}

      {activeTab === "routing" && (
        <RoutingTab
          settings={settings}
          loading={loading}
          updateFallbackStrategy={updateFallbackStrategy}
          updateStickyLimit={updateStickyLimit}
          updateComboStrategy={updateComboStrategy}
          updateComboStickyLimit={updateComboStickyLimit}
        />
      )}

      {activeTab === "network" && (
        <NetworkTab
          settings={settings}
          loading={loading}
          proxyForm={proxyForm}
          setProxyForm={setProxyForm}
          proxyStatus={proxyStatus}
          proxyLoading={proxyLoading}
          proxyTestLoading={proxyTestLoading}
          updateOutboundProxy={updateOutboundProxy}
          testOutboundProxy={testOutboundProxy}
          updateOutboundProxyEnabled={updateOutboundProxyEnabled}
          observabilityEnabled={observabilityEnabled}
          updateObservabilityEnabled={updateObservabilityEnabled}
        />
      )}
    </div>
  );
}
