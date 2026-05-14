package com.univercell.pos;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import android.util.Base64;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;

public class BluetoothBridge {

    static final int PERM_CODE = 9201;
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private final WebView webView;
    private final Activity activity;
    private BluetoothSocket socket;
    private OutputStream out;
    String permCallbackId = null;

    BluetoothBridge(WebView webView, Activity activity) {
        this.webView = webView;
        this.activity = activity;
    }

    private BluetoothAdapter adapter() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            BluetoothManager mgr = (BluetoothManager) activity.getSystemService(Context.BLUETOOTH_SERVICE);
            return mgr != null ? mgr.getAdapter() : null;
        }
        return BluetoothAdapter.getDefaultAdapter();
    }

    @JavascriptInterface
    public void requestPermissions(String cbId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(activity, android.Manifest.permission.BLUETOOTH_CONNECT)
                    == PackageManager.PERMISSION_GRANTED) {
                cb(cbId, "granted", null);
                return;
            }
            permCallbackId = cbId;
            activity.runOnUiThread(() ->
                ActivityCompat.requestPermissions(activity,
                    new String[]{ android.Manifest.permission.BLUETOOTH_CONNECT }, PERM_CODE));
        } else {
            cb(cbId, "granted", null);
        }
    }

    @SuppressLint("MissingPermission")
    @JavascriptInterface
    public String listPaired() {
        try {
            BluetoothAdapter a = adapter();
            if (a == null)        return err("Bluetooth not supported on this device");
            if (!a.isEnabled())   return err("Bluetooth is turned off");
            Set<BluetoothDevice> bonded = a.getBondedDevices();
            JSONArray arr = new JSONArray();
            for (BluetoothDevice d : bonded) {
                JSONObject o = new JSONObject();
                o.put("name",    d.getName() != null ? d.getName() : "Unknown");
                o.put("address", d.getAddress());
                arr.put(o);
            }
            return "{\"devices\":" + arr + "}";
        } catch (Exception e) {
            return err(e.getMessage());
        }
    }

    @SuppressLint("MissingPermission")
    @JavascriptInterface
    public void connect(String address, String cbId) {
        new Thread(() -> {
            BluetoothSocket s = null;
            try {
                BluetoothAdapter a = adapter();
                if (a == null) { cb(cbId, null, "Bluetooth not supported"); return; }
                closeSocket();
                BluetoothDevice device = a.getRemoteDevice(address);

                // 1st attempt: reflection socket on channel 1 — most reliable on modern Android
                // (bypasses SDP lookup and security negotiation that breaks on Android 12+)
                try {
                    Method m = device.getClass().getMethod("createRfcommSocket", int.class);
                    s = (BluetoothSocket) m.invoke(device, 1);
                    s.connect();
                } catch (Exception e1) {
                    try { if (s != null) s.close(); } catch (Exception ignored) {}
                    // 2nd attempt: insecure SPP via UUID
                    s = device.createInsecureRfcommSocketToServiceRecord(SPP);
                    s.connect();
                }

                // Critical on Android 12+: give the BT stack time to open the data channel
                Thread.sleep(400);

                socket = s;
                // getInputStream() activates full-duplex on some Android/Samsung versions
                socket.getInputStream();
                out = s.getOutputStream();
                cb(cbId, "ok", null);
            } catch (Exception e) {
                try { if (s != null) s.close(); } catch (Exception ignored) {}
                cb(cbId, null, e.getMessage() != null ? e.getMessage() : "connect failed");
            }
        }).start();
    }

    @JavascriptInterface
    public void write(String b64, String cbId) {
        new Thread(() -> {
            try {
                if (out == null) { cb(cbId, null, "Not connected to printer"); return; }
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                // Write in 20-byte chunks with 20ms gaps — forces Android BT stack to
                // actually transmit each chunk instead of indefinitely buffering.
                int off = 0;
                while (off < data.length) {
                    int len = Math.min(20, data.length - off);
                    out.write(data, off, len);
                    Thread.sleep(20);
                    off += len;
                }
                out.flush();
                Thread.sleep(200); // Wait for final chunk to physically leave the radio
                cb(cbId, "ok", null);
            } catch (Exception e) {
                cb(cbId, null, e.getMessage() != null ? e.getMessage() : "write error");
            }
        }).start();
    }

    @JavascriptInterface
    public void disconnect() {
        closeSocket();
    }

    @JavascriptInterface
    public void ping(String cbId) {
        cb(cbId, "pong", null);
    }

    void onPermissionResult(boolean granted) {
        if (permCallbackId != null) {
            cb(permCallbackId, granted ? "granted" : "denied", null);
            permCallbackId = null;
        }
    }

    private void closeSocket() {
        try { if (socket != null) socket.close(); } catch (IOException ignored) {}
        socket = null;
        out = null;
    }

    private static String err(String msg) {
        return "{\"error\":\"" + (msg != null ? msg.replace("\"", "'") : "unknown") + "\"}";
    }

    private void cb(String id, String result, String error) {
        String js;
        if (error != null) {
            String safe = error.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", "");
            js = "window._btCb('" + id + "',null,'" + safe + "')";
        } else {
            js = "window._btCb('" + id + "','" + result + "',null)";
        }
        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}
