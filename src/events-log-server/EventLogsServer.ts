import * as net from 'net';
import { LoggingEventVO } from './KarateEventLogsModels';

export default class EventLogsServer {
    private static port = null;
    public server: net.Server = null;
    constructor(private callback: (event: LoggingEventVO) => void) {}

    public static getPort() {
        return EventLogsServer.port;
    }

    createServer() {
        this.server = net.createServer((socket: net.Socket) => {
            console.log(
                'Client connect: ' +
                    socket.localAddress +
                    ':' +
                    socket.localPort +
                    '. client remote address : ' +
                    socket.remoteAddress +
                    ':' +
                    socket.remotePort
            );

            socket.setEncoding('utf-8');
            socket.setTimeout(10000);

            // When receive client data.
            socket.on('data', data => {
                // console.log(data.toString());
                if (this.callback) {
                    data.toString()
                        .split('\n')
                        .forEach(log => this.callback(JSON.parse(log)));
                }
            });

            // When client send data complete.
            socket.on('end', () => {
                console.log('Client disconnect.');

                // Get current connections count.
                this.server.getConnections((err, count) => {
                    if (!err) {
                        // Print current connection count in server console.
                        console.log('There are %d connections now. ', count);
                    } else {
                        console.error(JSON.stringify(err));
                    }
                });
            });

            // When client timeout.
            socket.on('timeout', () => {
                console.log('Client request time out. ');
            });

            socket.on('error', error => {
                console.error(JSON.stringify(error));
            });
        });
    }
    start() {
        this.createServer();
        this.server.listen(0, () => {
            // Get server address info.
            console.log('TCP server listen on address : ' + JSON.stringify(this.server.address()));

            this.server.on('close', () => {
                console.log('TCP server socket is closed.');
            });

            this.server.on('error', error => {
                console.error(JSON.stringify(error));
            });
        });
        EventLogsServer.port = (this.server.address() as net.AddressInfo).port;
    }
    stop() {
        try {
            this.server.close(error => {
                console.error(JSON.stringify(error));
            });
        } catch (e) {}
        EventLogsServer.port = this.server = null;
    }
}
