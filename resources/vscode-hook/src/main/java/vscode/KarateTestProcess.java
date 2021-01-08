package vscode;

import com.intuit.karate.Main;
import com.intuit.karate.resource.ResourceUtils;
import org.slf4j.ILoggerFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

public class KarateTestProcess implements Runnable {

    private static final String LOGBACK_CONFIG = "logback.configurationFile";
    private static Logger karateLog;
    private static Logger log;

    private static boolean isStopped = false;
    private static boolean singleThread = false;
    private static List<String> portAliases = Arrays.asList("-d", "--debug", "-p", "--port");

    private Socket clientSocket;

    KarateTestProcess(Socket clientSocket) {
        this.clientSocket = clientSocket;
    }

    public static void main(String[] args) throws Exception {
        String checkIfKarateMainInClasspath = Main.class.getName();
        String logbackConfig = System.getProperty(LOGBACK_CONFIG);
        if (logbackConfig == null || logbackConfig.trim().length() == 0) {
            File logbackXml = ResourceUtils.classPathOrFile("logback.xml");
            File logbackTest = ResourceUtils.classPathOrFile("logback-test.xml");
            if (logbackTest != null) {
                System.setProperty(LOGBACK_CONFIG, "logback-test.xml");
            } else if (logbackXml != null) {
                System.setProperty(LOGBACK_CONFIG, "logback.xml");
            } else {
                System.setProperty(LOGBACK_CONFIG, "logback-nofile.xml");
            }
        }
        resetLoggerConfig();
        karateLog = LoggerFactory.getLogger("com.intuit.karate");
        log = LoggerFactory.getLogger("vscode.KarateTestProcess");

        int port = 0;
        boolean isDebug = false;
        for (int i = 0; i < args.length; i++) {
            if(portAliases.contains(args[i])) {
                isDebug = "-d".equals(args[i]) || "--debug".equals(args[i]);
                if(i + 1 < args.length) {
                    try {
                        port = Integer.parseInt(args[i+1]);
                        break;
                    } catch (NumberFormatException e){
                        e.printStackTrace();
                    }
                }
            }
        }

        if(isDebug) {
            List<String> argsList = args != null? Arrays.asList(args) : Collections.emptyList();
            if (!canKeepDebugSession()) {
                argsList = argsList.stream().filter(arg -> !"--debug-keepalive".equals(arg))
                        .collect(Collectors.toList());
            }
            if(!canSkipBackupReportDir()) {
                argsList = argsList.stream().filter(arg -> !arg.startsWith("--backup-reportdir")).collect(Collectors.toList());
            }
            try {
                Main.main(argsList.toArray(new String[argsList.size()]));
            } catch (Exception e) {
                e.printStackTrace();
                VSCodeOutputRuntimeHook.println(String.format(VSCodeOutputRuntimeHook.SUITE_FINISHED, 0, 0));
            }
            return;
        }

        try(ServerSocket serverSocket = new ServerSocket(port)) {
            System.out.println("KarateTestProcess test server started on port " + serverSocket.getLocalPort());
            while (!isStopped) {
                KarateTestProcess karateTestProcess = new KarateTestProcess(serverSocket.accept());
                if (singleThread) {
                    karateTestProcess.run();
                } else {
                    new Thread(karateTestProcess).start();
                }
            }
            log.debug("Stopping KarateTestProcess");
        }
    }

    public void run() {
        try {
            BufferedReader in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
            String line = in.readLine();
            String[] tokens = line.split(" ");
            if ("/stop".equals(tokens[1])) {
                isStopped = true;
                return;
            }

            String commandLine = URLDecoder.decode(tokens[1].substring(1), StandardCharsets.UTF_8.name());
            log.debug("Requested command: " + commandLine);
            if (!canSkipBackupReportDir()) {
                commandLine = commandLine.replace("--backup-reportdir=false", "");
                commandLine = commandLine.replace("--backup-reportdir=true", "");
                commandLine = commandLine.replace("--backup-reportdir", "");
            }
            log.debug("Executing command: " + commandLine);
            Main karateMain = Main.parseKarateOptions(commandLine);
            karateMain.getPaths().replaceAll(path -> path.replaceAll("^'|'$|^\"|\"$", "")); // unquote
            log.debug("Executing Karate Paths " + karateMain.getPaths());

            OutputStream output = clientSocket.getOutputStream();
            byte[] responseHeader = ("HTTP/1.1 200 OK\r\n" + "Content-Type: text/plain; charset=UTF-8\r\n\r\n").getBytes(StandardCharsets.UTF_8);
            output.write(responseHeader);
            output.write(("executing: " + commandLine + "\n").getBytes(StandardCharsets.UTF_8));
            output.close();
            in.close();
            clientSocket.close();

            karateMain.call();

        } catch (Exception e) {
            e.printStackTrace();
            VSCodeOutputRuntimeHook.println(String.format(VSCodeOutputRuntimeHook.SUITE_FINISHED, 0, 0));
        }
    }

    private static boolean canKeepDebugSession() {
        try {
            return Main.class.getDeclaredField("keepDebugServerAlive") != null;
        } catch (NoSuchFieldException e) {
            return false;
        }
    }

    private static boolean canSkipBackupReportDir()  {
        try {
            return Main.class.getDeclaredField("backupReportDir") != null;
        } catch (NoSuchFieldException e) {
            log.debug("canSkipBackupReportDir " + false);
            return false;
        }
    }

    private static void resetLoggerConfig() {
        ILoggerFactory factory = LoggerFactory.getILoggerFactory();
        try {
            Method reset = factory.getClass().getDeclaredMethod("reset");
            reset.invoke(factory);
            Class clazz = Class.forName("ch.qos.logback.classic.util.ContextInitializer");
            Object temp = clazz.getDeclaredConstructors()[0].newInstance(factory);
            Method autoConfig = clazz.getDeclaredMethod("autoConfig");
            autoConfig.invoke(temp);
        } catch (Exception e) {
            // ignore
        }
    }
}