// One in-flight or completed snapshot per content revision. Invalidation also
// supersedes pending work: a request must not return stale publication state.
export function createSnapshotCache<T>(load:()=>Promise<T>) {
  let revision=0,pending:Promise<T>|undefined;
  function get():Promise<T> {
    if(pending)return pending;
    const started=revision;
    const task=Promise.resolve().then(load).then(
      value=>started===revision?value:get(),
      error=>{if(started!==revision)return get();if(pending===task)pending=undefined;throw error;},
    );
    pending=task;return task;
  }
  return {get,invalidate(){revision++;pending=undefined;}};
}
