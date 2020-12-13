//Requires
const modulename = 'WebServer:DangerZone:Action';
const fs = require('fs-extra');
const { dir, log, logOk, logWarn, logError } = require('../../extras/console')(modulename);
const helpers = require('../../extras/helpers');

//Helper functions
const isUndefined = (x) => { return (typeof x === 'undefined') };
const anyUndefined = (...args) => { return [...args].some(x => (typeof x === 'undefined')) };


/**
 * Handle all the danger zone actions
 * @param {object} ctx
 */
module.exports = async function DangerZoneAction(ctx) {
    //Sanity check
    if(isUndefined(ctx.params.action)){
        return ctx.utils.error(400, 'Invalid Request');
    }
    const action = ctx.params.action;

    //Check permissions
    if(!ctx.utils.checkPermission('master', modulename)){
        return ctx.send({
            type: 'danger',
            message: `Only the master account has permission to view/use this page.`
        });
    }

    //Delegate to the specific action functions
    if(action == 'reset'){
        return handleReset(ctx);
    }else if(action == 'importBans'){
        if(ctx.request.body.dbType == 'easyadmin' || ctx.request.body.dbType == 'vmenu'){
            return await handleImportBansFile(ctx, ctx.request.body.dbType);
        }else if(ctx.request.body.dbType == 'bansql' || ctx.request.body.dbType == 'vrp'){
            return await handleImportBansDBMS(ctx, ctx.request.body.dbType);
        }else{
            return ctx.send({type: 'danger', message: `Invalid database type.`});
        }
        
    }else{
        return ctx.send({
            type: 'danger',
            message: 'Unknown settings action.'
        });
    }
};


//================================================================
/**
 * Handle FXServer settinga reset nad resurn to setup
 * @param {object} ctx
 */
function handleReset(ctx) {
    if(globals.fxRunner.fxChild !== null){
        ctx.utils.logCommand(`STOP SERVER`);
        globals.fxRunner.killServer(ctx.session.auth.username);
    }

    //Making sure the deployer is not running
    globals.deployer = null;

    //Preparing & saving config
    const newConfig = globals.configVault.getScopedStructure('fxRunner');
    newConfig.serverDataPath = false;
    newConfig.cfgPath = false;
    const saveStatus = globals.configVault.saveProfile('fxRunner', newConfig);

    //Sending output
    if(saveStatus){
        globals.fxRunner.refreshConfig();
        ctx.utils.logAction(`Resetting fxRunner settings.`);
        return ctx.send({success: true});
    }else{
        logWarn(`[${ctx.ip}][${ctx.session.auth.username}] Error resetting fxRunner settings.`);
        return ctx.send({type: 'danger', message: `<strong>Error saving the configuration file.</strong>`});
    }
}


//================================================================
/**
 * Handle the ban import via file
 * @param {object} ctx
 * @param {string} dbType
 */
async function handleImportBansFile(ctx, dbType) {
    //Sanity check
    if(isUndefined(ctx.request.body.banfile)){
        return ctx.utils.error(400, 'Invalid Request');
    }
    const banfilePath = ctx.request.body.banfile;

    let inBans;
    try {
        const rawFile = await fs.readFile(banfilePath);
        inBans = JSON.parse(rawFile);
    } catch (error) {
        return ctx.utils.render('basic/generic', {message: `Failed to import bans with error: ${error.message}`});
    }

    let invalid = 0;
    let imported = 0;
    
    try {
        for (let index = 0; index < inBans.length; index++) {
            const ban = inBans[index];
            const identifiers = ban.identifiers.filter((id)=>{
                return (typeof id == 'string') && Object.values(GlobalData.validIdentifiers).some(vf => vf.test(id));
            });
            if(!identifiers.length){
                invalid++;
                continue;
            }

            let author, reason, expiration;
            if(dbType == 'easyadmin'){
                author = (typeof ban.banner == 'string' && ban.banner.length)? ban.banner.trim() : 'unknown';
                reason = (typeof ban.reason == 'string' && ban.reason.length)? `[IMPORTED] ${ban.reason.trim()}` : '[IMPORTED] unknown';
                if(ban.expire == 10444633200){
                    expiration = false;
                }else if(Number.isInteger(ban.expire)){
                    expiration = ban.expire;
                }else{
                    invalid++;
                    continue;
                }

            }else if(dbType == 'vmenu'){
                author = (typeof ban.bannedBy == 'string' && ban.bannedBy.length)? ban.bannedBy.trim() : 'unknown';
                reason = (typeof ban.banReason == 'string' && ban.banReason.length)? `[IMPORTED] ${ban.banReason.trim()}` : '[IMPORTED] unknown';
                if(ban.bannedUntil == '3000-01-01T00:00:00'){
                    expiration = false;
                }else{
                    const expirationDate = new Date(ban.bannedUntil);
                    if(expirationDate.toString() == 'Invalid Date'){
                        invalid++;
                        continue;
                    }else{
                        expiration = Math.round(expirationDate.getTime()/1000);
                    }
                }
            }

            await globals.playerController.registerAction(identifiers, 'ban', author, reason, expiration);
            imported++;
        }// end for()
    } catch (error) {
        dir(error)
        return ctx.utils.render('basic/generic', {message: `Failed to import bans with error: ${error.message}`});
    }

    const outMessage = `<b>Process finished!</b> <br>
        Imported bans: ${imported} <br>
        Invalid bans: ${invalid}  <br>`;
    return ctx.utils.render('basic/generic', {message: outMessage});
}

//================================================================
/**
 * Handle the ban import via dbms
 * @param {object} ctx
 * @param {string} dbType
 */
async function handleImportBansDBMS(ctx, dbType) {
    //Sanity check
    if(anyUndefined(ctx.params.action)){
        return ctx.utils.error(400, 'Invalid Request');
    }
    const action = ctx.params.action;
    dir(ctx.request.body)

    return ctx.send({type: 'danger', message: `dbmssss`});
}