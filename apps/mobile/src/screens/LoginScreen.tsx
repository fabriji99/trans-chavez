import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { notify } from "../lib/dialogs";
import { usernameToEmail } from "@trans-chavez/shared";

export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password) {
      notify("Faltan datos", "Ingresa tu usuario y contraseña.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      // Solo usuario: el correo interno se arma por dentro
      email: usernameToEmail(username),
      password,
    });
    if (!error) {
      // Una sola sesión por usuario: cierra la que estuviera abierta en otro dispositivo
      await supabase.rpc("claim_single_session");
    }
    setLoading(false);
    if (error) {
      notify("Error", "Usuario o contraseña incorrectos.");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trans. Chávez</Text>
      <Text style={styles.subtitle}>App del cobrador</Text>

      <TextInput
        style={styles.input}
        placeholder="Usuario"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Ingresar</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f3f8f7",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0e2a47",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#5b6b7b",
    textAlign: "center",
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: "#b8ccc8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#0f8a7d",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
