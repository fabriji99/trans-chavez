import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./src/lib/supabase";
import {
  getLocalTrips,
  refreshReference,
  startAutoSync,
  syncPending,
} from "./src/lib/offline";
import { confirmAction } from "./src/lib/dialogs";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { TicketScreen } from "./src/screens/TicketScreen";
import { StartTripScreen } from "./src/screens/StartTripScreen";
import { TripDetailScreen } from "./src/screens/TripDetailScreen";
import type { Profile, Route, Trip } from "@trans-chavez/shared";

type Screen =
  | { name: "home" }
  | { name: "start" }
  | { name: "ticket"; trip: Trip; route: Route }
  | { name: "detail"; trip: Trip; route: Route; backTo: "home" | "ticket" };

const PROFILE_KEY = "profile:last";

async function readCachedProfile(): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: "home" });

  // Sin señal al abrir la app: se entra con el último perfil guardado y se sincroniza después
  const userIdRef = useRef<string | null>(null);
  const [offlineProfile, setOfflineProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      userIdRef.current = data.session?.user.id ?? null;
      setSession(data.session);
      if (!data.session && error) {
        setOfflineProfile(await readCachedProfile());
      }
      setInitializing(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        // Solo se vuelve al inicio al entrar o salir; renovar el token en carretera no debe sacar al cobrador de su viaje
        if (userIdRef.current !== (newSession?.user.id ?? null)) setScreen({ name: "home" });
        userIdRef.current = newSession?.user.id ?? null;
        setSession(newSession);
        if (newSession) setOfflineProfile(null);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (data) {
        setProfile(data as Profile);
        AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(data)).catch(() => {});
        return;
      }
      const cached = await readCachedProfile();
      setProfile(cached?.id === session.user.id ? cached : null);
    })();
  }, [session]);

  const activeProfile = profile ?? offlineProfile;

  useEffect(() => {
    if (!activeProfile) return;
    void refreshReference();
    return startAutoSync(activeProfile.id, activeProfile.code);
  }, [activeProfile?.id, activeProfile?.code]);

  async function handleLogout() {
    if (activeProfile) {
      void syncPending(activeProfile.id);
      const pending = (await getLocalTrips(activeProfile.id)).some((lt) => lt.rev > lt.syncedRev);
      if (pending) {
        const ok = await confirmAction(
          "Hay viajes sin sincronizar",
          "Si sales ahora, los viajes guardados en este teléfono no se enviarán hasta que vuelvas a entrar con señal. ¿Salir de todos modos?",
          "Salir",
        );
        if (!ok) return;
      }
    }
    await AsyncStorage.removeItem(PROFILE_KEY).catch(() => {});
    setOfflineProfile(null);
    setProfile(null);
    await supabase.auth.signOut();
  }

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session && !offlineProfile) {
    return <LoginScreen />;
  }

  if (!activeProfile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (activeProfile.role !== "cobrador") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Esta cuenta no tiene permiso de cobrador.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {screen.name === "home" && (
        <HomeScreen
          profile={activeProfile}
          onOpenTrip={(trip, route) => setScreen({ name: "ticket", trip, route })}
          onViewTrip={(trip, route) =>
            setScreen({ name: "detail", trip, route, backTo: "home" })
          }
          onStartTrip={() => setScreen({ name: "start" })}
          onLogout={handleLogout}
        />
      )}
      {screen.name === "start" && (
        <StartTripScreen
          profile={activeProfile}
          onBack={() => setScreen({ name: "home" })}
          onStarted={(trip, route) => setScreen({ name: "ticket", trip, route })}
        />
      )}
      {screen.name === "ticket" && (
        <TicketScreen
          trip={screen.trip}
          route={screen.route}
          profile={activeProfile}
          onBack={() => setScreen({ name: "home" })}
          onViewTickets={() =>
            setScreen({ name: "detail", trip: screen.trip, route: screen.route, backTo: "ticket" })
          }
        />
      )}
      {screen.name === "detail" && (
        <TripDetailScreen
          trip={screen.trip}
          route={screen.route}
          userId={activeProfile.id}
          onBack={() =>
            setScreen(
              screen.backTo === "ticket"
                ? { name: "ticket", trip: screen.trip, route: screen.route }
                : { name: "home" },
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Deja libre la barra de estado (hora, batería) para que los botones de arriba se puedan tocar
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) : 0,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { textAlign: "center", color: "#dc2626", fontSize: 15 },
});
