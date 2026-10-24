import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

/**
 * Reports whether the phone can reach the internet. `isInternetReachable` is more accurate than `isConnected` (a phone can be on
 * Wi-Fi with no internet), but it can be `null` until checked, so fall back to `isConnected`. `null` means "not known yet".
 * Returns an unsubscribe function.
 */
export function subscribeConnectivity(onChange: (online: boolean | null) => void): () => void {
  return NetInfo.addEventListener((state: NetInfoState) => {
    onChange(state.isInternetReachable ?? state.isConnected);
  });
}
