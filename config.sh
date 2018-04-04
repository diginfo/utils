ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $ROOT

NODE="/usr/share/nodejs";
REPO="https://github.com/diginfo/utils.git";
BASHDIS="/etc/bashrc.dis";

LINE='alias pm2-logs="/usr/share/nodejs/utils/pm2-logs.js"';
grep -q -F "$LINE" $BASHDIS || echo "$LINE" >> $BASHDIS;

LINE='alias pm2-events="/usr/share/nodejs/utils/pm2-events.js"';
grep -q -F "$LINE" $BASHDIS || echo "$LINE" >> $BASHDIS;

LINE='alias pure-admin="/usr/share/nodejs/utils/pure-admin.js"';
grep -q -F "$LINE" $BASHDIS || echo "$LINE" >> $BASHDIS;

LINE='alias myslow="/usr/share/nodejs/utils/myslow.js"';
grep -q -F "$LINE" $BASHDIS || echo "$LINE" >> $BASHDIS;

source $BASHDIS;