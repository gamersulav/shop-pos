package com.univercell.pos;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private BluetoothBridge btBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        btBridge = new BluetoothBridge(getBridge().getWebView(), this);
        getBridge().getWebView().addJavascriptInterface(btBridge, "ShopBT");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == BluetoothBridge.PERM_CODE && btBridge != null) {
            btBridge.onPermissionResult(
                grantResults.length > 0 &&
                grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED
            );
        }
    }
}
